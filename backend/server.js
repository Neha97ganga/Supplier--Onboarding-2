const express = require("express");
const cors = require("cors");
const multer = require("multer");
const db = require("./db");
const { generateRulesFromSampleDoc } = require("./ruleGenerator");
const { extractTextFromFile } = require("./extractText");
const { decideDocumentStatus, decideSupplierStatus } = require("./ruleChecker");
const { generateSyntheticSupplier } = require("./ruleGenerator");
const { generateSupplierDocuments } = require("./ruleGenerator");
const app = express();

/* ---------- Middleware ---------- */
app.use(cors());
app.use(express.json());

/* ---------- Check Tables ---------- */
db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, rows) => {
  if (err) console.error(err);
  else console.log("📦 Tables in DB:", rows);
});

/* ---------- Health Check ---------- */
app.get("/", (_req, res) => {
  res.send("Backend is running");
});

/* ---------- Multer Config ---------- */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  }
});
const upload = multer({ storage });

/* ---------- Add Supplier ---------- */
app.post("/suppliers", (req, res) => {
  const { supplier_name, category } = req.body;

  db.run(
    `INSERT INTO suppliers (supplier_name, category, status)
     VALUES (?, ?, ?)`,
    [supplier_name, category, "Pending"],
    function (err) {
      if (err) {
        console.error("❌ DB error (suppliers):", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.json({ supplier_id: this.lastID });
    }
  );
});

/* ---------- Get Suppliers ---------- */
app.get("/suppliers", (_req, res) => {
  db.all(`SELECT * FROM suppliers `, [], (err, rows) => {
    if (err) {
      console.error("❌ DB error (get suppliers):", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows);
  });
});

/* ---------- Upload REAL Supplier Document ---------- */
app.post("/documents", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "❌ File not received by backend" });
    }

    const { supplier_id, document_type } = req.body;
    const filePath = req.file.path;

    console.log("📄 Checking supplier document...");
    console.log("FILE:", req.file);
    console.log("BODY:", req.body);

    // Extract text
    const text = await extractTextFromFile(filePath);

    // Load rules
    const rules = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM rules WHERE document_type = ?`,
        [document_type],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    if (!rules.length) {
      return res.status(400).json({ error: "No rules found for this document type" });
    }

    let results = [];

    for (const rule of rules) {
      const pass = text.toLowerCase().includes(rule.check_id.toLowerCase());
      const result = pass ? "pass" : "fail";

      results.push({ ...rule, result });

      db.run(
        `INSERT INTO rule_results VALUES (NULL, ?, ?, ?, ?)`,
        [supplier_id, document_type, rule.check_id, result]
      );
    }

    const docStatus = decideDocumentStatus(results);

    db.run(
      `INSERT INTO document_results VALUES (NULL, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [supplier_id, document_type, docStatus]
    );

    const supplierStatus = await decideSupplierStatus(supplier_id);

    db.run(
      `UPDATE suppliers SET status = ? WHERE supplier_id = ?`,
      [supplierStatus, supplier_id]
    );

    console.log("📊 Document Decision:", docStatus);
    console.log("📊 Supplier Decision:", supplierStatus);

    res.json({
      document_status: docStatus,
      supplier_status: supplierStatus
    });

  } catch (err) {
    console.error("❌ Document checking failed:", err);
    res.status(500).json({ error: "Document checking failed" });
  }
});

/* ---------- Upload SAMPLE Document & Generate Rules ---------- */
app.post("/sample-documents", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File not received" });
    }

    const { document_type } = req.body;
    const filePath = req.file.path;

    console.log("🔥 SAMPLE DOCUMENT ROUTE HIT");
    console.log("📄 File:", filePath);

    const rules = await generateRulesFromSampleDoc(filePath, document_type);

    console.log("✅ Rules generated successfully");
    res.json({ rules });

  } catch (err) {
    console.error("❌ RULE GENERATION ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});
/* ---------- Generate Supplier using AI ---------- */
app.post("/generate-supplier", async (req, res) => {
  try {
    console.log("🤖 Generating supplier using AI...");

    const supplier = await generateSyntheticSupplier();

    db.run(
      `INSERT INTO suppliers (supplier_name, category, status)
       VALUES (?, ?, ?)`,
      [supplier.supplier_name, supplier.category, "Pending"],
      function (err) {
        if (err) {
          console.error("DB insert error:", err);
          return res.status(500).json({ error: "DB insert failed" });
        }

        console.log("✅ Generated supplier saved:", supplier);

        res.json({
          supplier_id: this.lastID,
          supplier
        });
      }
    );

  } catch (err) {
    console.error("❌ Supplier generation failed:", err);
    res.status(500).json({ error: "Supplier generation failed" });
  }
});

app.post("/generate-supplier-docs", async (req, res) => {
  try {
    const { supplier_name, category } = req.body;

    console.log("📄 Generating docs for:", supplier_name, category);

    const files = await generateSupplierDocuments(
      supplier_name,
      category
    );

    res.json({ message: "Docs generated", files });

  } catch (err) {
    console.error("❌ Generation failed:", err);
    res.status(500).json({ error: "Generation failed" });
  }
});

/* ---------- Start Server ---------- */
app.listen(5000, () => {
  console.log("Backend running");
});

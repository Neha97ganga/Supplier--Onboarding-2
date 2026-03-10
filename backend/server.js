require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const OpenAI = require("openai");
const db = require("./db");
const { generateRulesFromSampleDoc } = require("./ruleGenerator");
const { extractTextFromFile } = require("./extractText");
const { decideDocumentStatus, decideSupplierStatus } = require("./ruleChecker");
const { generateSyntheticSupplier } = require("./ruleGenerator");
const { generateSupplierDocuments } = require("./ruleGenerator");
const app = express();

const llmClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

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

/* ---------- Get Rules (Human Review) ---------- */
app.get("/rules", (req, res) => {
  const { document_type } = req.query;

  const sql = document_type
    ? `SELECT * FROM rules WHERE document_type = ?`
    : `SELECT * FROM rules`;
  const params = document_type ? [document_type] : [];

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("❌ DB error (get rules):", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows);
  });
});

/* ---------- Delete Single Rule (Cleanup) ---------- */
app.delete("/rules/:id", (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM rules WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        console.error("❌ DB error (delete rule):", err);
        return res.status(500).json({ error: "DB error" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json({ success: true });
    }
  );
});

/* ---------- Supplier Profile (Admin View) ---------- */
app.get("/suppliers/:id/profile", async (req, res) => {
  const supplierId = req.params.id;

  try {
    const supplier = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM suppliers WHERE supplier_id = ?`,
        [supplierId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const documents = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM document_results WHERE supplier_id = ? ORDER BY checked_at DESC`,
        [supplierId],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    const ruleResults = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM rule_results WHERE supplier_id = ?`,
        [supplierId],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    res.json({
      supplier,
      documents,
      rule_results: ruleResults
    });
  } catch (err) {
    console.error("❌ Supplier profile fetch failed:", err);
    res.status(500).json({ error: "Failed to load supplier profile" });
  }
});

/* ---------- Supplier Decision Explanation (LLM) ---------- */
app.get("/suppliers/:id/explanation", async (req, res) => {
  console.log("🔥 Explanation route hit for supplier:", req.params.id);
  const supplierId = req.params.id;

  try {
    const supplier = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM suppliers WHERE supplier_id = ?`,
        [supplierId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    const documents = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM document_results WHERE supplier_id = ? ORDER BY checked_at DESC`,
        [supplierId],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    const ruleResults = await new Promise((resolve, reject) => {
      db.all(
        `SELECT rr.*, r.description, r.severity
         FROM rule_results rr
         LEFT JOIN rules r
           ON rr.document_type = r.document_type
          AND rr.check_id = r.check_id
        WHERE rr.supplier_id = ?`,
        [supplierId],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

    const finalStatus = supplier.status || "PENDING";

    const docSummary = documents.map((d) => ({
      document_type: d.document_type,
      status: d.status,
      checked_at: d.checked_at
    }));

    const failedChecks = ruleResults.filter((r) => r.result === "fail");

    const ruleSummary = failedChecks.map((r) => ({
      document_type: r.document_type,
      check_id: r.check_id,
      severity: r.severity || "unknown",
      description: r.description || ""
    }));

    let explanation;

    try {
      const messages = [
        {
          role: "system",
          content:
            "You explain supplier onboarding decisions in clear, human language. " +
            "Keep it concise and structured with short paragraphs and bullet points. " +
            "Avoid technical jargon and do not return JSON."
        },
        {
          role: "user",
          content: `
Supplier basic details:
- Name: ${supplier.supplier_name}
- Category: ${supplier.category}
- Final status: ${finalStatus}

Document decisions:
${JSON.stringify(docSummary, null, 2)}

Failed rule checks (if any):
${JSON.stringify(ruleSummary, null, 2)}

Explain in plain English:
1. Why this supplier is ACCEPTED, ON_HOLD, REJECT or still PENDING.
2. Which documents or checks were most important for this decision.
3. If not accepted, what the supplier should do next to get approved.
`
        }
      ];

      const response = await llmClient.chat.completions.create({
        model: "openai/gpt-oss-safeguard-20b",
        temperature: 0.2,
        messages
      });

      explanation = response.choices?.[0]?.message?.content?.trim();
    } catch (llmError) {
      console.error("❌ LLM explanation failed, falling back:", llmError);
    }

    if (!explanation) {
      // Fallback human-readable explanation without LLM
      const statusText =
        finalStatus === "REJECT"
          ? "The supplier has been rejected based on one or more document checks."
          : finalStatus === "ON_HOLD"
          ? "The supplier is currently on hold because some important documents did not fully pass the checks."
          : finalStatus === "ACCEPT"
          ? "The supplier has been accepted because all required documents passed the checks that were run."
          : "The supplier is still pending because not enough documents have been checked yet.";

      const failedSummary =
        failedChecks.length === 0
          ? "So far we do not see any failed rule checks."
          : `The following checks failed: ${failedChecks
              .map((c) => `${c.document_type} – ${c.check_id}`)
              .join(", ")}.`;

      explanation = `${statusText}\n\n${failedSummary}\n\nThis text was generated without calling the LLM because the LLM request failed. Once the LLM is configured correctly, a richer explanation will appear here automatically.`;
    }

    res.json({
      supplier_status: finalStatus,
      explanation
    });
  } catch (err) {
    console.error("❌ Supplier explanation failed:", err);
    res.status(500).json({ error: "Failed to generate explanation" });
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
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

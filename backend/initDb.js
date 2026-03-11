const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      supplier_id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT,
      category TEXT,
      status TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      document_id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      document_type TEXT,
      file_path TEXT,
      upload_date TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS decisions (
      decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      decision TEXT,
      reason TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      evaluation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      criteria TEXT,
      score INTEGER
    )
  `);
   db.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_type TEXT,
      check_id TEXT,
      description TEXT,
      severity TEXT
    )
  `);

  console.log("✅ Tables created successfully");
});

db.close();

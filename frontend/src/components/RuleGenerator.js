import { useState, useEffect } from "react";
import { getRules, deleteRule } from "../api";

function RuleGenerator() {
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedRules, setGeneratedRules] = useState(null);
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState("");

  const loadRules = async (type) => {
    if (!type) {
      setRules([]);
      return;
    }
    try {
      setRulesLoading(true);
      setRulesError("");
      const data = await getRules(type);
      setRules(data);
    } catch (e) {
      console.error(e);
      setRulesError("Failed to load existing rules");
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    if (docType) {
      loadRules(docType);
    }
  }, [docType]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file || !docType) {
      alert("Select document type and file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", docType);

    try {
      setLoading(true);
      console.log("🚀 Sending request using fetch");

      const res = await fetch("https://supplier-onboarding-2.onrender.com/sample-documents", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("❌ Backend error:", data);
        alert(data.error || "Rule generation failed");
        return;
      }

      console.log("✅ Rules received:", data);
      setGeneratedRules(data.rules);
      loadRules(docType);

    } catch (err) {
      console.error("❌ Fetch failed:", err);
      alert("Network or backend crash");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Delete this rule?")) return;

    try {
      await deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete rule");
    }
  };

  return (
    <div className="card">
      <h3>Generate Rules from Sample Supplier Document</h3>
      <p className="subtitle">
        Upload a sample compliant document to auto-generate checks, then review and clean them in the table below.
      </p>

      <form onSubmit={handleSubmit}>
        <label>Document Type</label>
        <select
  value={docType}
  onChange={(e) => setDocType(e.target.value)}
  required
>
  <option value="">Select</option>

  <option>Business Registration Certificate</option>
  <option>GST Registration Certificate</option>
  <option>FSSAI License</option>
  <option>ISO 22000 Certificate</option>
  <option>Quality Audit Report</option>
  <option>Certificate of Analysis (COA)</option>
  <option>ESG Declaration</option>
  <option>Food-Grade Compliance Certificate</option>
  <option>Transport License</option>
  <option>Insurance Certificate</option>
  <option>Refrigerated Vehicle Capability Certificate</option>
  <option>Temperature Monitoring / Calibration Certificate</option>
</select>


        <label>Upload Sample Document (PDF)</label>
        <input
          type="file"
          accept=".pdf"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Generating..." : "Generate Rules"}
        </button>
      </form>

      {generatedRules && (
        <div style={{ marginTop: 16 }}>
          <p className="subtitle">
            New rules were generated and stored. You can review all rules for this document type below.
          </p>
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h4>Existing rules for this document type</h4>
      {rulesLoading && <p>Loading rules…</p>}
      {rulesError && <p className="error">{rulesError}</p>}

      {!rulesLoading && !rulesError && docType && rules.length === 0 && (
        <p>No rules exist yet for this document type.</p>
      )}

      {!rulesLoading && rules.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Check ID</th>
              <th>Description</th>
              <th>Severity</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.check_id}</td>
                <td>{rule.description}</td>
                <td>{rule.severity}</td>
                <td>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleDeleteRule(rule.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default RuleGenerator;

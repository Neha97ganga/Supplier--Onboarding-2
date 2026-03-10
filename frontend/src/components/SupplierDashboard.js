import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  uploadDocument,
  getSupplierProfile,
  getSupplierExplanation
} from "../api";

function SupplierDashboard({ supplierId }) {
  const [tab, setTab] = useState("upload"); // "upload" | "status"

  const [docType, setDocType] = useState("");
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [explanationError, setExplanationError] = useState("");

  const loadStatus = async () => {
    if (!supplierId) return;

    setProfileLoading(true);
    setProfileError("");
    setExplanation("");
    setExplanationError("");

    try {
      const profileData = await getSupplierProfile(supplierId);
      setProfile(profileData);
    } catch (e) {
      console.error("Supplier dashboard profile load failed", e);
      setProfileError("Failed to load your status");
    } finally {
      setProfileLoading(false);
    }

    try {
      const explanationData = await getSupplierExplanation(supplierId);
      setExplanation(explanationData.explanation);
    } catch (e) {
      console.error("Supplier dashboard explanation load failed", e);
      setExplanationError("Failed to load explanation");
    }
  };

  useEffect(() => {
  if (tab === "status") {
    loadStatus();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tab]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!docType || !file) {
      setUploadMessage("Please select a document type and file");
      return;
    }

    const formData = new FormData();
    formData.append("supplier_id", supplierId);
    formData.append("document_type", docType);
    formData.append("file", file);

    try {
      setUploadLoading(true);
      setUploadMessage("");

      const result = await uploadDocument(formData);

      setUploadMessage(
        `Document: ${result.document_status} | Overall status: ${result.supplier_status}`
      );
    } catch (err) {
      console.error(err);
      setUploadMessage("Upload failed");
    } finally {
      setUploadLoading(false);
      setDocType("");
      setFile(null);
    }
  };

  return (
    <div className="card">
      <h3>Supplier Portal</h3>
      <p className="subtitle">
        Upload your documents and track the status of your onboarding decision.
      </p>

      <div className="tab-toggle">
        <button
          type="button"
          className={tab === "upload" ? "active" : ""}
          onClick={() => setTab("upload")}
        >
          Upload documents
        </button>
        <button
          type="button"
          className={tab === "status" ? "active" : ""}
          onClick={() => setTab("status")}
        >
          Status & explanation
        </button>
      </div>

      {tab === "upload" && (
        <form onSubmit={handleUpload}>
          <label>Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            required
          >
            <option value="">Select document</option>
            <option>Business Registration Certificate</option>
            <option>GST Registration Certificate</option>
            <option>FSSAI License</option>
            <option>ISO 22000 Certificate</option>
            <option>Quality Audit Report</option>
            <option value="COA">Certificate of Analysis (COA)</option>
            <option>ESG Declaration</option>
            <option>Food-Grade Compliance Certificate</option>
            <option>Transport License</option>
            <option>Insurance Certificate</option>
            <option>Refrigerated Vehicle Capability Certificate</option>
            <option>Temperature Monitoring / Calibration Certificate</option>
          </select>

          <label>Choose File</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])}
            required
          />

          <button type="submit" disabled={uploadLoading}>
            {uploadLoading ? "Uploading & checking..." : "Upload & check"}
          </button>

          {uploadMessage && (
            <p
              className={
                uploadMessage.includes("REJECT")
                  ? "error"
                  : uploadMessage.includes("ON_HOLD")
                  ? "warning"
                  : "success"
              }
              style={{ marginTop: 12 }}
            >
              {uploadMessage}
            </p>
          )}
        </form>
      )}

      {tab === "status" && (
        <div className="supplier-status-panel">
          {profileLoading && <p>Loading your latest status…</p>}
          {profileError && <p className="error">{profileError}</p>}

          {profile && (
            <>
              <section className="profile-section">
                <h4>Your basic details</h4>
                <p>
                  <strong>Supplier ID:</strong> {profile.supplier.supplier_id}
                </p>
                <p>
                  <strong>Name:</strong> {profile.supplier.supplier_name}
                </p>
                <p>
                  <strong>Category:</strong> {profile.supplier.category}
                </p>
                <p>
                  <strong>Overall status:</strong>{" "}
                  <span
                    className={`status ${profile.supplier.status.toLowerCase()}`}
                  >
                    {profile.supplier.status}
                  </span>
                </p>
              </section>

              <section className="profile-section">
                <h4>Uploaded documents</h4>
                {profile.documents.length === 0 ? (
                  <p>No documents have been checked yet.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Document type</th>
                        <th>Status</th>
                        <th>Checked at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.documents.map((doc) => (
                        <tr key={doc.id}>
                          <td>{doc.document_type}</td>
                          <td>
                            <span
                              className={`status ${doc.status.toLowerCase()}`}
                            >
                              {doc.status}
                            </span>
                          </td>
                          <td>{new Date(doc.checked_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="profile-section">
                <h4>Why this decision was taken</h4>
                {explanationError && (
                  <p className="error">{explanationError}</p>
                )}
                {explanation ? (
                  <div className="explanation-box">
                    <ReactMarkdown>{explanation}</ReactMarkdown>
                  </div>
                ) : (
                  !explanationError && (
                    <p>
                      No explanation is available yet. Upload a document to
                      trigger a decision.
                    </p>
                  )
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default SupplierDashboard;


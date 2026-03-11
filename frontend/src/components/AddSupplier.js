import { useState } from "react";
import { addSupplier } from "../api";
const BASE_URL =
  process.env.REACT_APP_API_URL || "https://is-supplier-onboarding-cwe0.onrender.com";

function AddSupplier() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    await addSupplier({
      supplier_name: name,
      category
    });

    setMessage("Supplier added successfully");
    setName("");
    setCategory("");
  };

  // 👇 AI GENERATE SUPPLIER
  const generateSupplier = async () => {
    try {
      const res = await fetch(`${BASE_URL}/generate-supplier`, {
        method: "POST"
      });

      const data = await res.json();

      // Auto-fill form with generated data
      setName(data.supplier.supplier_name);
      setCategory(data.supplier.category);

      setMessage("AI generated supplier — you can edit & save");

    } catch (err) {
      console.error(err);
      setMessage("Failed to generate supplier");
    }
  };
const generateDocuments = async () => {
  if (!name || !category) {
    setMessage("Enter supplier name & category first");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/generate-supplier-docs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        supplier_name: name,
        category
      })
    });

    await res.json();
    setMessage("Required documents generated in /data/generated");

  } catch (err) {
    console.error(err);
    setMessage("Document generation failed");
  }
};

  return (
    <div className="card">
      <h3>Add Supplier</h3>
      <p className="subtitle">Enter supplier details to onboard</p>

      {/* 👇 AI BUTTON */}
      <button
        type="button"
        onClick={generateSupplier}
        style={{ marginBottom: "12px" }}
      >
        Generate Supplier (AI)
      </button>
      <button
  type="button"
  onClick={generateDocuments}
  style={{ marginBottom: "12px", marginLeft: "10px" }}
>
  Generate Required Documents
</button>

      <form onSubmit={handleSubmit}>
        <label>Supplier Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., ABC Foods Pvt Ltd"
          required
        />

        <label>Category</label>
        <select
  value={category}
  onChange={(e) => setCategory(e.target.value)}
  required
>
  <option value="">Select category</option>

  {/* Visible text stays SAME, value matches backend */}
  <option value="Raw Materials (Ingredients/Spices)">
    Raw Material
  </option>

  <option value="Packaging Materials (Food-Grade)">
    Packaging Materials
  </option>

  <option value="Logistics">
    Logistics
  </option>
</select>

        <button type="submit">Save Supplier</button>
      </form>

      {message && <p className="success">{message}</p>}
    </div>
  );
}

export default AddSupplier;

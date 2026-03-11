const BASE_URL =
  process.env.REACT_APP_API_URL || "https://supplier-onboarding-2.onrender.com";

export async function getSuppliers() {
  const res = await fetch(`${BASE_URL}/suppliers`);
  return res.json();
}

export async function addSupplier(data) {
  const res = await fetch(`${BASE_URL}/suppliers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function uploadDocument(formData) {
  const res = await fetch(`${BASE_URL}/documents`, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  return data;   // 👈 return decision
}

// Fetch rules for a given document type (or all if not specified)
export async function getRules(documentType) {
  const params = documentType ? `?document_type=${encodeURIComponent(documentType)}` : "";
  const res = await fetch(`${BASE_URL}/rules${params}`);
  if (!res.ok) {
    throw new Error("Failed to load rules");
  }
  return res.json();
}

// Delete a single rule by id
export async function deleteRule(id) {
  const res = await fetch(`${BASE_URL}/rules/${id}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    throw new Error("Failed to delete rule");
  }
  return res.json();
}

// Get detailed supplier profile (for admin view)
export async function getSupplierProfile(id) {
  const res = await fetch(`${BASE_URL}/suppliers/${id}/profile`);
  if (!res.ok) {
    throw new Error("Failed to load supplier profile");
  }
  return res.json();
}

// Get human-readable explanation for supplier decision (LLM-backed)
export async function getSupplierExplanation(id) {
  const res = await fetch(`${BASE_URL}/suppliers/${id}/explanation`);
  if (!res.ok) {
    throw new Error("Failed to load supplier explanation");
  }
  return res.json();
}

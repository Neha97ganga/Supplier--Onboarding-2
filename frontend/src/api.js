const BASE_URL = "http://localhost:5000";

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

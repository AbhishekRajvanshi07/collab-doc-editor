const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function getStoredUserId() {
  return localStorage.getItem("userId");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const userId = getStoredUserId();
  if (userId) headers["x-user-id"] = userId;
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  listUsers: () => request("/api/users"),
  listDocuments: () => request("/api/documents"),
  getDocument: (id) => request(`/api/documents/${id}`),
  createDocument: (title) => request("/api/documents", { method: "POST", body: { title } }),
  updateDocument: (id, patch) => request(`/api/documents/${id}`, { method: "PUT", body: patch }),
  deleteDocument: (id) => request(`/api/documents/${id}`, { method: "DELETE" }),
  listShares: (id) => request(`/api/documents/${id}/shares`),
  addShare: (id, userId, permission) =>
    request(`/api/documents/${id}/shares`, { method: "POST", body: { userId, permission } }),
  removeShare: (id, userId) =>
    request(`/api/documents/${id}/shares/${userId}`, { method: "DELETE" }),
  uploadFile: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/api/upload", { method: "POST", body: form, isForm: true });
  },
};

export { getStoredUserId };

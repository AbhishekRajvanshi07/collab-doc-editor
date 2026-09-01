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

  // --- stretch features ---------------------------------------------

  listVersions: (id) => request(`/api/documents/${id}/versions`),
  restoreVersion: (id, versionId) =>
    request(`/api/documents/${id}/versions/${versionId}/restore`, { method: "POST" }),

  listComments: (id) => request(`/api/documents/${id}/comments`),
  addComment: (id, body) =>
    request(`/api/documents/${id}/comments`, { method: "POST", body: { body } }),
  deleteComment: (id, commentId) =>
    request(`/api/documents/${id}/comments/${commentId}`, { method: "DELETE" }),

  pingPresence: (id) => request(`/api/documents/${id}/presence`, { method: "POST" }),

  // Export triggers a real file download rather than returning JSON, so
  // it can't reuse the shared request() helper above (which always
  // parses a JSON body) - it needs to read a Blob and hand the browser
  // a download instead.
  exportDocument: async (id, format) => {
    const userId = getStoredUserId();
    const res = await fetch(`${API_BASE}/api/documents/${id}/export?format=${format}`, {
      headers: userId ? { "x-user-id": userId } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="(.+)"/);
    const filename = match ? match[1] : `document.${format}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export { getStoredUserId };

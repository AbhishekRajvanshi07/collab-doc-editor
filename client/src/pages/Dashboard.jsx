import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

function DocRow({ doc, onOpen, onDelete }) {
  return (
    <div className="doc-row">
      <button className="doc-row-main" onClick={() => onOpen(doc.id)}>
        <div>
          <strong>{doc.title}</strong>
          {doc.owner_name && <div className="muted small">Owned by {doc.owner_name}</div>}
        </div>
        <div className="muted small">
          {doc.access !== "owner" && <span className="badge">{doc.access}</span>}
          {new Date(doc.updated_at).toLocaleString()}
        </div>
      </button>
      {doc.access === "owner" && (
        <button
          className="link-button danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doc.id, doc.title);
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [owned, setOwned] = useState([]);
  const [shared, setShared] = useState([]);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const load = () => {
    api
      .listDocuments()
      .then((res) => {
        setOwned(res.owned);
        setShared(res.shared);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const createDoc = async () => {
    try {
      const doc = await api.createDocument("Untitled document");
      navigate(`/documents/${doc.id}`);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    try {
      await api.deleteDocument(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const doc = await api.uploadFile(file);
      navigate(`/documents/${doc.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="page">
      <header className="topbar">
        <h1>Collab Docs</h1>
        <div className="topbar-right">
          <span className="muted">
            Signed in as <strong>{currentUser.name}</strong>
          </span>
          <button className="link-button" onClick={logout}>
            Switch user
          </button>
        </div>
      </header>

      <div className="toolbar-row">
        <button className="primary" onClick={createDoc}>
          + New document
        </button>
        <button onClick={() => fileInputRef.current.click()}>Upload .txt / .md</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section>
        <h2>My documents</h2>
        {owned.length === 0 && <p className="muted">No documents yet — create one above.</p>}
        <div className="doc-list">
          {owned.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              onOpen={(id) => navigate(`/documents/${id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </section>

      <section>
        <h2>Shared with me</h2>
        {shared.length === 0 && <p className="muted">Nothing has been shared with you yet.</p>}
        <div className="doc-list">
          {shared.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              onOpen={(id) => navigate(`/documents/${id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

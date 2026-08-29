import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ShareModal({ docId, onClose }) {
  const { users, currentUser } = useAuth();
  const [shares, setShares] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [permission, setPermission] = useState("edit");
  const [error, setError] = useState("");

  const refresh = () => {
    api
      .listShares(docId)
      .then(setShares)
      .catch((e) => setError(e.message));
  };

  useEffect(refresh, [docId]);

  const shareableUsers = users.filter(
    (u) => u.id !== currentUser.id && !shares.some((s) => s.user_id === u.id)
  );

  const handleShare = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    try {
      await api.addShare(docId, Number(selectedUserId), permission);
      setSelectedUserId("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRevoke = async (userId) => {
    try {
      await api.removeShare(docId, userId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Share document</h2>
        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleShare} className="share-form">
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Select a person…</option>
            {shareableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
          <select value={permission} onChange={(e) => setPermission(e.target.value)}>
            <option value="edit">Can edit</option>
            <option value="view">Can view</option>
          </select>
          <button type="submit" className="primary" disabled={!selectedUserId}>
            Share
          </button>
        </form>

        <h3>People with access</h3>
        <ul className="share-list">
          <li>
            <strong>{currentUser.name}</strong> <span className="muted small">(owner)</span>
          </li>
          {shares.map((s) => (
            <li key={s.user_id}>
              <span>
                {s.name} <span className="muted small">({s.permission})</span>
              </span>
              <button className="link-button" onClick={() => handleRevoke(s.user_id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>

        <button className="close-button" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

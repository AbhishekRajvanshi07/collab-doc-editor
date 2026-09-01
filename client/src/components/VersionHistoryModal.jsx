import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function VersionHistoryModal({ docId, canRestore, onClose, onRestored }) {
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listVersions(docId)
      .then(setVersions)
      .catch((e) => setError(e.message));
  }, [docId]);

  const restore = async (versionId) => {
    if (
      !window.confirm(
        "Restore this version? Your current content will be saved as a new version first, so this can be undone."
      )
    )
      return;
    try {
      await api.restoreVersion(docId, versionId);
      onRestored();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Version history</h2>
        {error && <div className="error-banner">{error}</div>}

        {versions.length === 0 && (
          <p className="muted small">
            No earlier versions yet — a snapshot is saved periodically as the document is edited.
          </p>
        )}

        <ul className="share-list">
          {versions.map((v) => (
            <li key={v.id}>
              <span>
                {v.title}{" "}
                <span className="muted small">
                  — {new Date(v.created_at).toLocaleString()} by {v.created_by_name}
                </span>
              </span>
              {canRestore && (
                <button className="link-button" onClick={() => restore(v.id)}>
                  Restore
                </button>
              )}
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

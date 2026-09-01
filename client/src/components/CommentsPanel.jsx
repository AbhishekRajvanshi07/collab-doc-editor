import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function CommentsPanel({ docId, canComment, onClose }) {
  const { currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    api
      .listComments(docId)
      .then(setComments)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [docId]);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    try {
      await api.addComment(docId, trimmed);
      setBody("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (commentId) => {
    try {
      await api.deleteComment(docId, commentId);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="comments-panel">
      <div className="comments-header">
        <h3>Comments</h3>
        <button className="link-button" onClick={onClose}>
          Close
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="comments-list">
        {comments.length === 0 && <p className="muted small">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <div className="comment-meta">
              <strong>{c.name}</strong>
              <span className="muted small">{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <p>{c.body}</p>
            {c.user_id === currentUser.id && (
              <button className="link-button danger small" onClick={() => remove(c.id)}>
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {canComment ? (
        <form className="comment-form" onSubmit={submit}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
          />
          <button type="submit" className="primary">
            Comment
          </button>
        </form>
      ) : (
        <p className="muted small">You have view-only access, so you can't add comments.</p>
      )}
    </div>
  );
}

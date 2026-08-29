import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { users, login, loading } = useAuth();

  if (loading) return <div className="centered">Loading users…</div>;

  return (
    <div className="centered">
      <div className="login-card">
        <h1>Collab Docs</h1>
        <p className="muted">
          Pick a demo account to continue. This is a mocked login (no
          passwords) — see the README for why.
        </p>
        <div className="user-list">
          {users.map((u) => (
            <button key={u.id} className="user-button" onClick={() => login(u)}>
              <span className="avatar">{u.name[0]}</span>
              <span>
                <strong>{u.name}</strong>
                <div className="muted small">{u.email}</div>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

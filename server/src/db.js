// db.js — Postgres connection pool + schema/seed bootstrap.
//
// Uses a single DATABASE_URL connection string (the standard shape every
// managed Postgres provider - Neon, Supabase, Render Postgres, RDS -
// hands you). This makes persistence fully independent of the app
// server's own disk: the API container can be redeployed, restarted, or
// scaled to multiple instances and the data lives on regardless. See
// ARCHITECTURE.md for why this replaced an earlier SQLite version.

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Point it at a Postgres connection string " +
      "(see DEPLOYMENT.md for how to get a free one from Neon)."
  );
}

// Managed Postgres providers (Neon, Supabase, Render) require SSL and
// commonly present a cert chain that Node's default TLS trust store
// doesn't validate the same way libpq would - so we relax verification
// for non-local connections rather than fail closed on every provider's
// self-signed intermediate. Localhost (used for tests/dev) skips SSL
// entirely since there's no network hop to secure.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL DEFAULT 'Untitled document',
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS shares (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    permission TEXT NOT NULL DEFAULT 'edit',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(document_id, user_id)
  );
`;

// Idempotent bootstrap: safe to call on every server start. Creates the
// schema if missing, then seeds demo data only if the users table is
// still empty, so re-deploys never duplicate seed rows.
async function init() {
  await pool.query(SCHEMA_SQL);

  const { rows: userRows } = await pool.query("SELECT COUNT(*)::int AS c FROM users");
  if (userRows[0].c === 0) {
    await pool.query(
      `INSERT INTO users (name, email) VALUES
         ('Alice Chen', 'alice@example.com'),
         ('Bob Martinez', 'bob@example.com'),
         ('Carol Singh', 'carol@example.com')`
    );
  }

  const { rows: docRows } = await pool.query("SELECT COUNT(*)::int AS c FROM documents");
  if (docRows[0].c === 0) {
    const alice = await pool.query("SELECT id FROM users WHERE email = 'alice@example.com'");
    const bob = await pool.query("SELECT id FROM users WHERE email = 'bob@example.com'");
    const doc = await pool.query(
      `INSERT INTO documents (owner_id, title, content) VALUES ($1, $2, $3) RETURNING id`,
      [
        alice.rows[0].id,
        "Welcome to Collab Docs",
        "<h1>Welcome!</h1><p>This is a sample document. Try <strong>bold</strong>, <em>italic</em>, and lists.</p><ul><li>Create a doc</li><li>Share it</li><li>Upload a file</li></ul>",
      ]
    );
    await pool.query(
      `INSERT INTO shares (document_id, user_id, permission) VALUES ($1, $2, 'edit')`,
      [doc.rows[0].id, bob.rows[0].id]
    );
  }
}

module.exports = { pool, init };

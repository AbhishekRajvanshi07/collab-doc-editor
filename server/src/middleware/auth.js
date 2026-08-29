// auth.js
// Mocked auth: the client "logs in" by picking a seeded user, then sends
// that user's id on every request via the x-user-id header. There's no
// password/session because the assignment scope explicitly allows
// simulated users to keep the auth surface small. This middleware is the
// single choke point that resolves x-user-id -> a real user row, so every
// route downstream can trust req.user.

const { pool } = require("../db");

async function requireUser(req, res, next) {
  try {
    const userId = Number(req.header("x-user-id"));
    if (!userId) {
      return res.status(401).json({ error: "Missing x-user-id header" });
    }
    const { rows } = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [userId]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: "Unknown user" });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireUser };

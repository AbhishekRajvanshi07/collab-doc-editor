const express = require("express");
const { pool } = require("../db");
const { requireUser } = require("../middleware/auth");

const router = express.Router();
router.use(requireUser);

// --- helpers ---------------------------------------------------------

async function findDocument(id) {
  const { rows } = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
  return rows[0] || null;
}

// Returns the caller's access level for a document: 'owner', 'edit',
// 'view', or null if they have no access at all. Centralizing this means
// every route asks the same question the same way instead of each one
// re-deriving access rules.
async function getAccessLevel(doc, userId) {
  if (doc.owner_id === userId) return "owner";
  const { rows } = await pool.query(
    "SELECT permission FROM shares WHERE document_id = $1 AND user_id = $2",
    [doc.id, userId]
  );
  return rows[0] ? rows[0].permission : null;
}

// --- routes ------------------------------------------------------------

// GET /api/documents - documents the user owns, plus documents shared
// with them, returned as two separate lists so the UI can render the
// "My Docs" / "Shared with Me" distinction the assignment asks for.
router.get("/", async (req, res, next) => {
  try {
    const owned = await pool.query(
      `SELECT d.*, 'owner' AS access
       FROM documents d WHERE d.owner_id = $1
       ORDER BY d.updated_at DESC`,
      [req.user.id]
    );

    const shared = await pool.query(
      `SELECT d.*, s.permission AS access, u.name AS owner_name
       FROM documents d
       JOIN shares s ON s.document_id = d.id
       JOIN users u ON u.id = d.owner_id
       WHERE s.user_id = $1
       ORDER BY d.updated_at DESC`,
      [req.user.id]
    );

    res.json({ owned: owned.rows, shared: shared.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents - create a new, empty document owned by the caller.
router.post("/", async (req, res, next) => {
  try {
    const title = (req.body.title || "Untitled document").toString().trim().slice(0, 200) || "Untitled document";
    const content = typeof req.body.content === "string" ? req.body.content : "";

    const { rows } = await pool.query(
      "INSERT INTO documents (owner_id, title, content) VALUES ($1, $2, $3) RETURNING *",
      [req.user.id, title, content]
    );
    res.status(201).json({ ...rows[0], access: "owner" });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id - fetch one document. Requires owner/edit/view access.
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const access = await getAccessLevel(doc, req.user.id);
    if (!access) return res.status(403).json({ error: "You don't have access to this document" });

    res.json({ ...doc, access });
  } catch (err) {
    next(err);
  }
});

// PUT /api/documents/:id - update title and/or content. Owner or a
// share with 'edit' permission may write; 'view'-only shares are rejected.
router.put("/:id", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const access = await getAccessLevel(doc, req.user.id);
    if (!access) return res.status(403).json({ error: "You don't have access to this document" });
    if (access === "view") return res.status(403).json({ error: "You only have view access" });

    let title = doc.title;
    if (req.body.title !== undefined) {
      const trimmed = String(req.body.title).trim().slice(0, 200);
      title = trimmed || "Untitled document"; // never persist a blank title
    }
    const content = req.body.content !== undefined ? String(req.body.content) : doc.content;

    const { rows } = await pool.query(
      "UPDATE documents SET title = $1, content = $2, updated_at = now() WHERE id = $3 RETURNING *",
      [title, content, doc.id]
    );
    res.json({ ...rows[0], access });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id - owner only.
router.delete("/:id", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can delete this document" });
    }
    await pool.query("DELETE FROM documents WHERE id = $1", [doc.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id/shares - list who a document is shared with.
// Owner only, so non-owners can't enumerate the share list.
router.get("/:id/shares", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can view sharing settings" });
    }
    const { rows } = await pool.query(
      `SELECT s.id, s.permission, u.id AS user_id, u.name, u.email
       FROM shares s JOIN users u ON u.id = s.user_id
       WHERE s.document_id = $1`,
      [doc.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/shares - grant another user access. Owner only.
// Body: { userId, permission: 'view' | 'edit' }
router.post("/:id/shares", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can share this document" });
    }

    const targetUserId = Number(req.body.userId);
    const permission = req.body.permission === "view" ? "view" : "edit";

    if (!targetUserId) return res.status(400).json({ error: "userId is required" });
    if (targetUserId === doc.owner_id) {
      return res.status(400).json({ error: "Document is already owned by this user" });
    }
    const target = await pool.query("SELECT id FROM users WHERE id = $1", [targetUserId]);
    if (!target.rows[0]) return res.status(404).json({ error: "Target user not found" });

    await pool.query(
      `INSERT INTO shares (document_id, user_id, permission) VALUES ($1, $2, $3)
       ON CONFLICT (document_id, user_id) DO UPDATE SET permission = excluded.permission`,
      [doc.id, targetUserId, permission]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id/shares/:userId - revoke access. Owner only.
router.delete("/:id/shares/:userId", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can modify sharing" });
    }
    await pool.query(
      "DELETE FROM shares WHERE document_id = $1 AND user_id = $2",
      [doc.id, req.params.userId]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require("express");
const PDFDocument = require("pdfkit");
const { pool } = require("../db");
const { requireUser } = require("../middleware/auth");
const presence = require("../presence");
const { parseBlocks, htmlToMarkdown } = require("../utils/convert");

const router = express.Router();
router.use(requireUser);

// --- helpers ---------------------------------------------------------

async function findDocument(id) {
  const { rows } = await pool.query("SELECT * FROM documents WHERE id = $1", [id]);
  return rows[0] || null;
}

// Returns the caller's access level for a document: 'owner', 'edit',
// 'comment', 'view', or null if they have no access at all.
// 'comment' is a third permission tier (the role-based-sharing stretch
// feature) sitting between 'view' and 'edit': can read the document and
// post comments, but cannot change its content. Centralizing this means
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

const CAN_EDIT_CONTENT = new Set(["owner", "edit"]);
const CAN_COMMENT = new Set(["owner", "edit", "comment"]);

// Snapshots a document's pre-edit state into document_versions, but only
// if enough time has passed since the last snapshot - otherwise the
// 800ms-debounced autosave would create a new row on nearly every
// keystroke. This is the version-history stretch feature's write path;
// routes/documents.js's PUT handler calls this before applying an edit.
const VERSION_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function maybeSnapshotVersion(doc, userId) {
  const { rows } = await pool.query(
    "SELECT created_at FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1",
    [doc.id]
  );
  const lastSnapshotAt = rows[0]
    ? new Date(rows[0].created_at).getTime()
    : new Date(doc.created_at).getTime();
  if (Date.now() - lastSnapshotAt < VERSION_SNAPSHOT_INTERVAL_MS) return;

  await pool.query(
    "INSERT INTO document_versions (document_id, title, content, created_by) VALUES ($1, $2, $3, $4)",
    [doc.id, doc.title, doc.content, userId]
  );
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
    if (!CAN_EDIT_CONTENT.has(access)) {
      return res.status(403).json({ error: "You don't have edit access to this document" });
    }

    await maybeSnapshotVersion(doc, req.user.id);

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
    const permission = ["view", "comment", "edit"].includes(req.body.permission)
      ? req.body.permission
      : "edit";

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

// --- version history (stretch) -----------------------------------------

// GET /api/documents/:id/versions - list saved snapshots, newest first.
// Anyone with access can view history; only owner/edit can restore.
router.get("/:id/versions", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const access = await getAccessLevel(doc, req.user.id);
    if (!access) return res.status(403).json({ error: "You don't have access to this document" });

    const { rows } = await pool.query(
      `SELECT v.id, v.title, v.created_at, u.name AS created_by_name
       FROM document_versions v JOIN users u ON u.id = v.created_by
       WHERE v.document_id = $1 ORDER BY v.created_at DESC`,
      [doc.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/versions/:versionId/restore - roll the
// document back to a saved snapshot. The current state is snapshotted
// first, so a restore is itself always undoable.
router.post("/:id/versions/:versionId/restore", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const access = await getAccessLevel(doc, req.user.id);
    if (!CAN_EDIT_CONTENT.has(access)) {
      return res.status(403).json({ error: "You need edit access to restore a version" });
    }

    const { rows } = await pool.query(
      "SELECT * FROM document_versions WHERE id = $1 AND document_id = $2",
      [req.params.versionId, doc.id]
    );
    const version = rows[0];
    if (!version) return res.status(404).json({ error: "Version not found" });

    await pool.query(
      "INSERT INTO document_versions (document_id, title, content, created_by) VALUES ($1, $2, $3, $4)",
      [doc.id, doc.title, doc.content, req.user.id]
    );
    const { rows: updated } = await pool.query(
      "UPDATE documents SET title = $1, content = $2, updated_at = now() WHERE id = $3 RETURNING *",
      [version.title, version.content, doc.id]
    );
    res.json({ ...updated[0], access });
  } catch (err) {
    next(err);
  }
});

// --- export (stretch) ---------------------------------------------------

// GET /api/documents/:id/export?format=md|pdf - download the document.
// Both formats are generated server-side from the same parseBlocks()
// representation (see utils/convert.js) so they can't drift apart.
router.get("/:id/export", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const access = await getAccessLevel(doc, req.user.id);
    if (!access) return res.status(403).json({ error: "You don't have access to this document" });

    const format = req.query.format === "pdf" ? "pdf" : "md";
    const safeTitle = (doc.title || "document").replace(/[^a-z0-9-_ ]/gi, "").trim() || "document";

    if (format === "md") {
      const markdown = `# ${doc.title}\n\n${htmlToMarkdown(doc.content)}\n`;
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.md"`);
      return res.send(markdown);
    }

    // PDF export. Emphasis (bold/italic) shows as literal **/* markers
    // rather than true bold/italic glyphs - see utils/convert.js for why.
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.pdf"`);
    const pdf = new PDFDocument({ margin: 50 });
    pdf.pipe(res);
    pdf.fontSize(22).text(doc.title);
    pdf.moveDown();
    for (const block of parseBlocks(doc.content)) {
      if (block.type === "h1") pdf.fontSize(18).text(block.text).moveDown(0.5);
      else if (block.type === "h2") pdf.fontSize(15).text(block.text).moveDown(0.5);
      else if (block.type === "h3") pdf.fontSize(13).text(block.text).moveDown(0.5);
      else if (block.type === "li") pdf.fontSize(11).text(`•  ${block.text}`, { indent: 20 }).moveDown(0.2);
      else if (block.type === "oli") pdf.fontSize(11).text(`${block.index}.  ${block.text}`, { indent: 20 }).moveDown(0.2);
      else pdf.fontSize(11).text(block.text).moveDown(0.5);
    }
    pdf.end();
  } catch (err) {
    next(err);
  }
});

// --- comments (stretch) --------------------------------------------------

// GET /api/documents/:id/comments - list the document's comment thread.
router.get("/:id/comments", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const access = await getAccessLevel(doc, req.user.id);
    if (!access) return res.status(403).json({ error: "You don't have access to this document" });

    const { rows } = await pool.query(
      `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.name
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.document_id = $1 ORDER BY c.created_at ASC`,
      [doc.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/comments - add a comment. Requires at least
// 'comment' access; plain 'view' access cannot post (that distinction is
// the point of the role-based-sharing stretch feature).
router.post("/:id/comments", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const access = await getAccessLevel(doc, req.user.id);
    if (!access) return res.status(403).json({ error: "You don't have access to this document" });
    if (!CAN_COMMENT.has(access)) {
      return res.status(403).json({ error: "View-only access can't add comments" });
    }

    const body = (req.body.body || "").toString().trim().slice(0, 2000);
    if (!body) return res.status(400).json({ error: "Comment body is required" });

    const { rows } = await pool.query(
      "INSERT INTO comments (document_id, user_id, body) VALUES ($1, $2, $3) RETURNING *",
      [doc.id, req.user.id, body]
    );
    res.status(201).json({ ...rows[0], name: req.user.name });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id/comments/:commentId - remove a comment.
// The comment's author or the document owner may delete it.
router.delete("/:id/comments/:commentId", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const access = await getAccessLevel(doc, req.user.id);
    if (!access) return res.status(403).json({ error: "You don't have access to this document" });

    const { rows } = await pool.query(
      "SELECT * FROM comments WHERE id = $1 AND document_id = $2",
      [req.params.commentId, doc.id]
    );
    const comment = rows[0];
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (comment.user_id !== req.user.id && doc.owner_id !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own comments" });
    }

    await pool.query("DELETE FROM comments WHERE id = $1", [comment.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// --- presence (real-time collaboration indicators, stretch) -------------

// POST /api/documents/:id/presence - heartbeat + read in one call: marks
// the caller as actively viewing this document, then returns everyone
// else currently active on it. The client polls this every few seconds
// (see client/src/pages/Editor.jsx) rather than holding a WebSocket open.
router.post("/:id/presence", async (req, res, next) => {
  try {
    const doc = await findDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    const access = await getAccessLevel(doc, req.user.id);
    if (!access) return res.status(403).json({ error: "You don't have access to this document" });

    presence.ping(doc.id, req.user);
    res.json({ active: presence.getActiveUsers(doc.id, req.user.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require("express");
const multer = require("multer");
const path = require("path");
const { pool } = require("../db");
const { requireUser } = require("../middleware/auth");

const router = express.Router();
router.use(requireUser);

// Scope decision: we only support .txt and .md uploads, converted into a
// new editable document. Full .docx parsing (a zipped XML format) was
// judged out of scope for the time budget - see ARCHITECTURE.md. This is
// stated in the UI as well, per the assignment's instruction to be
// explicit about supported file types.
const ALLOWED_EXTENSIONS = new Set([".txt", ".md"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB - plenty for a text/markdown doc
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("Only .txt and .md files are supported"));
    }
    cb(null, true);
  },
});

// Very small, dependency-free Markdown -> HTML pass covering just the
// formatting the editor itself supports (headings, bold, italic, lists).
// This isn't a full CommonMark implementation - it's intentionally scoped
// to round-trip cleanly with the Tiptap editor's own output.
function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listOpen = null; // 'ul' | 'ol' | null

  const closeList = () => {
    if (listOpen) {
      html.push(`</${listOpen}>`);
      listOpen = null;
    }
  };

  const inline = (text) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "") {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (listOpen !== "ul") {
        closeList();
        html.push("<ul>");
        listOpen = "ul";
      }
      html.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (numbered) {
      if (listOpen !== "ol") {
        closeList();
        html.push("<ol>");
        listOpen = "ol";
      }
      html.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join("\n");
}

function plainTextToHtml(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{1,}/)
    .filter((p) => p.trim() !== "")
    .map(
      (p) =>
        `<p>${p
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</p>`
    )
    .join("\n");
}

// POST /api/upload - multipart form, field name "file". Creates a new
// document owned by the caller from the uploaded file's content.
router.post("/", (req, res, next) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const text = req.file.buffer.toString("utf-8");
      const html = ext === ".md" ? markdownToHtml(text) : plainTextToHtml(text);
      const title = path.basename(req.file.originalname, ext).slice(0, 200) || "Imported document";

      const { rows } = await pool.query(
        "INSERT INTO documents (owner_id, title, content) VALUES ($1, $2, $3) RETURNING *",
        [req.user.id, title, html]
      );
      res.status(201).json({ ...rows[0], access: "owner" });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});

module.exports = router;

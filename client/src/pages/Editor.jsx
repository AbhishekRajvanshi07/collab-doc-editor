import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { api } from "../api/client";
import ShareModal from "../components/ShareModal";
import CommentsPanel from "../components/CommentsPanel";
import VersionHistoryModal from "../components/VersionHistoryModal";
import "../style/editor.css";

// Debounce helper for autosave - avoids firing a PUT on every keystroke.
function useDebouncedCallback(callback, delay) {
  const timer = useRef(null);
  return useCallback(
    (...args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
}

const SAVE_STATES = { IDLE: "idle", SAVING: "saving", SAVED: "saved", ERROR: "error" };
const CAN_EDIT_CONTENT = new Set(["owner", "edit"]);
const CAN_COMMENT = new Set(["owner", "edit", "comment"]);
const PRESENCE_POLL_MS = 5000;

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState(SAVE_STATES.IDLE);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeViewers, setActiveViewers] = useState([]);
  const [exporting, setExporting] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: "",
    editable: false, // flipped on once we know the user's access level
    onUpdate: ({ editor }) => {
      debouncedSaveContent(editor.getHTML());
    },
  });

  const saveContent = useCallback(
    async (html) => {
      setSaveState(SAVE_STATES.SAVING);
      try {
        await api.updateDocument(id, { content: html });
        setSaveState(SAVE_STATES.SAVED);
      } catch (e) {
        setSaveState(SAVE_STATES.ERROR);
        setError(e.message);
      }
    },
    [id]
  );
  const debouncedSaveContent = useDebouncedCallback(saveContent, 800);

  const loadDocument = useCallback(async () => {
    try {
      const d = await api.getDocument(id);
      setDoc(d);
      setTitle(d.title);
      if (editor) editor.commands.setContent(d.content || "");
    } catch (e) {
      setError(e.message);
    }
  }, [id, editor]);

  useEffect(() => {
    let cancelled = false;
    api
      .getDocument(id)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setTitle(d.title);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load fetched content into the editor once both are ready, and set
  // editability based on the caller's access level. Both 'view' and
  // 'comment' shares are read-only for content - 'comment' additionally
  // unlocks the comment thread, which is handled separately below.
  useEffect(() => {
    if (editor && doc) {
      editor.commands.setContent(doc.content || "");
      editor.setEditable(CAN_EDIT_CONTENT.has(doc.access));
    }
  }, [editor, doc]);

  // Real-time collaboration indicator: poll a lightweight presence
  // endpoint every few seconds. This is intentionally polling, not a
  // WebSocket - see server/src/presence.js for why.
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    const tick = () => {
      api
        .pingPresence(id)
        .then((res) => {
          if (!cancelled) setActiveViewers(res.active);
        })
        .catch(() => {
          /* presence is best-effort; a failed ping shouldn't surface an error banner */
        });
    };
    tick();
    const interval = setInterval(tick, PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, doc]);

  const handleTitleBlur = async () => {
    if (!doc || title === doc.title) return;
    try {
      const updated = await api.updateDocument(id, { title });
      setDoc(updated);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      await api.exportDocument(id, format);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  if (error && !doc) {
    return (
      <div className="page">
        <div className="error-banner">{error}</div>
        <button onClick={() => navigate("/")}>Back to documents</button>
      </div>
    );
  }

  if (!doc) return <div className="centered">Loading…</div>;

  return (
    <div className="page">
      <header className="topbar">
        <button className="link-button" onClick={() => navigate("/")}>
          ← All documents
        </button>
        <input
          className="title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          disabled={!CAN_EDIT_CONTENT.has(doc.access)}
        />
        <div className="topbar-right">
          {activeViewers.length > 0 && (
            <div
              className="presence-stack"
              title={`${activeViewers.map((u) => u.name).join(", ")} viewing now`}
            >
              {activeViewers.map((u) => (
                <span key={u.id} className="presence-avatar">
                  {u.name[0]}
                </span>
              ))}
            </div>
          )}
          <span className="muted small save-indicator">
            {saveState === SAVE_STATES.SAVING && "Saving…"}
            {saveState === SAVE_STATES.SAVED && "Saved"}
            {saveState === SAVE_STATES.ERROR && "Save failed"}
          </span>
          <button onClick={() => handleExport("md")} disabled={exporting}>
            Export .md
          </button>
          <button onClick={() => handleExport("pdf")} disabled={exporting}>
            Export PDF
          </button>
          <button onClick={() => setHistoryOpen(true)}>History</button>
          <button onClick={() => setCommentsOpen((v) => !v)}>Comments</button>
          {doc.access === "owner" && <button onClick={() => setShareOpen(true)}>Share</button>}
          {doc.access === "comment" && <span className="badge">Comment only</span>}
          {doc.access === "view" && <span className="badge">View only</span>}
        </div>
      </header>

      {editor && (
        <div className="toolbar-row editor-toolbar">
          <button
            className={editor.isActive("bold") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.isEditable}
          >
            Bold
          </button>
          <button
            className={editor.isActive("italic") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.isEditable}
          >
            Italic
          </button>
          <button
            className={editor.isActive("underline") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            disabled={!editor.isEditable}
          >
            Underline
          </button>
          <button
            className={editor.isActive("heading", { level: 1 }) ? "active" : ""}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            disabled={!editor.isEditable}
          >
            H1
          </button>
          <button
            className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            disabled={!editor.isEditable}
          >
            H2
          </button>
          <button
            className={editor.isActive("bulletList") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={!editor.isEditable}
          >
            • List
          </button>
          <button
            className={editor.isActive("orderedList") ? "active" : ""}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={!editor.isEditable}
          >
            1. List
          </button>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="editor-surface">
        <EditorContent editor={editor} />
      </div>

      {commentsOpen && (
        <CommentsPanel
          docId={id}
          canComment={CAN_COMMENT.has(doc.access)}
          onClose={() => setCommentsOpen(false)}
        />
      )}

      {shareOpen && <ShareModal docId={id} onClose={() => setShareOpen(false)} />}

      {historyOpen && (
        <VersionHistoryModal
          docId={id}
          canRestore={CAN_EDIT_CONTENT.has(doc.access)}
          onClose={() => setHistoryOpen(false)}
          onRestored={loadDocument}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { api } from "../api/client";
import ShareModal from "../components/ShareModal";

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

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState(SAVE_STATES.IDLE);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

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
  // editability based on the caller's access level ('view' shares are
  // read-only in the UI too, matching the backend's 403 on write).
  useEffect(() => {
    if (editor && doc) {
      editor.commands.setContent(doc.content || "");
      editor.setEditable(doc.access !== "view");
    }
  }, [editor, doc]);

  const handleTitleBlur = async () => {
    if (!doc || title === doc.title) return;
    try {
      const updated = await api.updateDocument(id, { title });
      setDoc(updated);
    } catch (e) {
      setError(e.message);
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
          disabled={doc.access === "view"}
        />
        <div className="topbar-right">
          <span className="muted small save-indicator">
            {saveState === SAVE_STATES.SAVING && "Saving…"}
            {saveState === SAVE_STATES.SAVED && "Saved"}
            {saveState === SAVE_STATES.ERROR && "Save failed"}
          </span>
          {doc.access === "owner" && (
            <button onClick={() => setShareOpen(true)}>Share</button>
          )}
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

      {shareOpen && <ShareModal docId={id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

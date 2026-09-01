# Submission

## Candidate
Abhishek Kumar — abhishekjnv2706@gmail.com

## What's included in this folder

- `server/` — Express + Postgres backend (source, tests, sample upload files)
- `client/` — React (Vite) frontend
- `README.md` — local setup and run instructions, seeded accounts, known limitations
- `ARCHITECTURE.md` — architecture note: what was prioritized and why
- `AI_WORKFLOW.md` — AI tool usage note
- `DEPLOYMENT.md` — step-by-step Render deployment guide (not required as
  a deliverable itself, but kept for reference/reproducibility)
- `VIDEO_SCRIPT.md` — talking-point script used to record the walkthrough
  (not required as a deliverable itself, kept for reference)
- `SUBMISSION.md` — this file
- `walkthrough-video.txt` — link to the recorded walkthrough (add before submitting)
- `screenshots/` — optional; setup is two commands (`npm install && npm run dev`)
  so this isn't required per the brief, but add a quick GIF here if you want
  extra visual coverage

## Live deployment

- **Live URL:** https://collab-doc-editor-1-5l50.onrender.com
- **API URL:** https://collab-doc-editor-pn3j.onrender.com (frontend talks to this; no need to visit directly)
- **Seeded test accounts:** no passwords; pick Alice Chen, Bob Martinez, or
  Carol Singh from the login screen. Alice's account starts with one
  document already shared with Bob.

## What's working

- Create / rename / edit documents with rich-text formatting (bold,
  italic, underline, H1/H2, bulleted and numbered lists)
- Documents persist to a managed Postgres database (Neon) and reload
  correctly after refresh — and survive a full server redeploy, since
  persistence lives outside the app container
- File upload: `.txt` and `.md` files convert into new editable documents
- Sharing: owner can grant `view` or `edit` access to another seeded
  user; "My documents" vs "Shared with me" are shown separately;
  view-only access is enforced server-side (403 on write attempts), not
  just hidden in the UI
- Autosave on edit (debounced), with a save-status indicator
- 5 passing automated tests covering the sharing/permission logic
  (`server/npm test`)

## Optional stretch features (all 5 added)

- **Real-time collaboration indicators** - shows who else is currently
  viewing a document (polling-based, not a full WebSocket co-editing
  layer)
- **Commenting** - a document-level comment thread (owner/editors/
  commenters can post; view-only cannot)
- **Document version history** - periodic snapshots, with restore
  (restoring itself creates a new snapshot, so it's undoable)
- **Export to PDF and Markdown** - both generated server-side from the
  document's content
- **Role-based sharing beyond view/edit** - added a third `comment`
  permission tier (can view + comment, cannot edit content), enforced
  server-side like the existing tiers

Each is deliberately scoped down from the "full" version of that feature
- see the "Stretch features" section in `ARCHITECTURE.md` for exactly
how and why. All 18 automated tests (10 original + 8 new) pass.

## What's incomplete / deliberately deprioritized

- No real password/session auth - mocked seeded-user login instead,
  which the brief explicitly allows for this scope
- No `.docx` file upload - only `.txt`/`.md` are supported for import
- No true concurrent-edit conflict resolution (OT/CRDT) - two people
  editing the same document at the exact same moment can still overwrite
  each other; the presence indicator helps a user notice someone else is
  there, but doesn't merge simultaneous edits

## What I'd build next with another 2-4 hours

1. Real `.docx` import via `mammoth.js`
2. Optimistic locking (or a lightweight CRDT) so two simultaneous editors
   on the same document don't silently overwrite each other
3. "Last edited by" attribution shown on shared documents
4. Inline, text-anchored comments (true suggestion mode) rather than a
   document-level thread

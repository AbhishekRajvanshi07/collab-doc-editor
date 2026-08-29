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

- **Live URL:** _add after deploying (Render recommended — see below)_
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

## What's incomplete / deliberately deprioritized

See "Known limitations" in `README.md` and the "What I deliberately did
not build" section in `ARCHITECTURE.md`. In short: no real-time
co-editing, no version history, no password auth, no `.docx` import.
All four were either explicitly optional in the brief or a
disproportionate time sink relative to what they'd demonstrate.

## What I'd build next with another 2-4 hours

1. Real `.docx` import via `mammoth.js`
2. Optimistic locking (or a lightweight CRDT) so two simultaneous editors
   on the same document don't silently overwrite each other
3. "Last edited by" attribution shown on shared documents
4. Basic document version history (even just periodic snapshots)

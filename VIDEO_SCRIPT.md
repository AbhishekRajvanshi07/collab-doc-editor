# Walkthrough Video Script (target: 3-5 minutes)

Record your screen (Loom is fine, unlisted) walking through the **live
deployed URL**, not localhost. Rough timing below adds up to ~4 minutes —
adjust to your pace, but hit every bullet; these map directly to what
the brief says the video must cover.

## 1. Intro (15-20s)

"This is Collab Docs, a lightweight collaborative document editor I
built for the Ajaia take-home. It's a React frontend, an Express/SQLite
backend, and I'll walk through the main flow, what works end to end,
what I intentionally cut, and how I used AI along the way."

## 2. Main user flow (90s)

- Open the live URL → show the login screen, explain it's mocked auth
  ("pick a seeded user, no passwords — I'll cover why in a sec")
- Log in as Alice → show the pre-seeded document, open it
- Type in the editor, apply bold/italic/underline, add an H1 and a
  bulleted list → "this is Tiptap under the hood"
- Rename the document via the title field
- Refresh the page → content and title persisted
- Create a **new** document from scratch
- Upload a `.md` file (one of `server/sample-files/`) → show it convert
  into a formatted document

## 3. Sharing (45-60s)

- On a doc you own, click **Share**, grant Bob "edit" access
- Switch users (top right) → log in as Bob → show the doc under
  "Shared with me", distinct from "My documents"
- Go back to Alice, share a *different* doc with Bob as **view only**
- Switch to Bob again → open it → show the toolbar disabled, mention:
  "this isn't just hidden in the UI — the API itself rejects the write
  with a 403, that's covered by an automated test"

## 4. What works end to end (20s)

Say explicitly: "So end to end: creating and formatting documents, file
upload for .txt and .md, owner/edit/view sharing, and persistence
across refresh — all of that works and is covered by 10 passing
automated tests."

## 5. What you intentionally deprioritized (30-40s)

"I deliberately cut a few things the brief called out as optional
stretch goals: real-time multi-cursor collaboration, version history,
and richer roles beyond view/edit. I also scoped file upload to .txt
and .md rather than .docx, since .docx parsing well is a much bigger
problem on its own. And auth is mocked rather than real passwords/JWT —
all of these are explained with reasoning in ARCHITECTURE.md."

## 6. Key implementation decisions (30s)

"A couple of decisions worth calling out: SQLite over Postgres for
zero-setup persistence at this scale, and the permission model is
enforced server-side on every write, not just hidden in the frontend —
that's the part I have automated tests around, since it's the piece
most likely to have a subtle bug."

## 7. How AI supported the workflow (30-40s)

"I used Claude as an AI pair-programmer — it scaffolded the Express
routes, the React/Tiptap integration, and the test suite quickly, which
freed up time for the actual judgment calls: what to cut, how strict
the permission checks needed to be, and verifying the upload conversion
was actually correct rather than just plausible-looking. I caught and
fixed one thing AI got wrong — it initially pinned a version of multer
with known vulnerabilities, which I upgraded after `npm install` flagged
it. Full details are in AI_WORKFLOW.md."

## 8. Close (10s)

"That's the core flow. README has setup instructions, and
ARCHITECTURE.md and AI_WORKFLOW.md have the full reasoning. Thanks for
watching."

---

**Before you hit record:** run through this once without recording so
the live-URL cold-start delay (Render free tier can take 30-60s to wake)
doesn't eat your first take. Consider opening the URL a minute before
you start recording so it's already warm.

# Architecture Note

## Goal and framing

The brief was intentionally open-ended: a lightweight Google-Docs-style
editor with creation/editing, file upload, sharing, and persistence,
under a 4-6 hour budget. I optimized for **a few things working
correctly end-to-end**, over broad shallow coverage, per the assignment's
own stated evaluation criteria.

## Key decisions

### 1. Postgres (managed/cloud) over SQLite

I started with SQLite (`better-sqlite3`) for zero local setup, which the
brief explicitly allows. I moved to a managed Postgres database (Neon)
before deployment for one concrete reason: SQLite lives as a file on the
API server's own disk, and Render's free web-service disk is ephemeral
across redeploys/restarts — fine for local dev, not something I wanted
to explain away for a reviewer testing the live link days later. Moving
persistence out to a real database server decouples it entirely from the
app container's lifecycle: the API can restart, redeploy, or (later)
scale to multiple instances, and the data doesn't care. The schema
(`users`, `documents`, `shares`) didn't change shape — only the driver
and the sync-vs-async query calls did (see `server/src/db.js`).

### 2. Mocked auth via seeded users

The brief allows "seeded accounts, mocked auth, or a lightweight login
flow." Building real password auth (hashing, sessions/JWT, login forms)
would have consumed a disproportionate share of the time budget relative
to what it demonstrates for this exercise. Instead: three seeded users,
a login screen that just picks one, and an `x-user-id` header carrying
identity on every request. This let me spend the saved time on the
editing experience and the permission logic itself, which is the part
the brief actually asks to see demonstrated ("a way to grant another user
access," "a visible distinction between owned and shared documents").

The permission model is still real, not decorative: every document route
resolves the caller to `owner` / `edit` / `view` / no-access server-side,
and view-only shares are rejected on write (403), not just hidden in the
UI. That logic is what's covered by the automated tests.

### 3. Tiptap for rich text, not a hand-rolled `contenteditable`

Tiptap (built on ProseMirror) gives bold/italic/underline/headings/lists
as composable extensions with a stable HTML serialization, which is
exactly the formatting set the brief asks for. Building a rich-text
editor from scratch was judged out of scope — it's a multi-week problem
on its own, and doing it poorly would hurt the demo more than using a
well-established library helps.

### 4. File upload scoped to `.txt` / `.md`, not `.docx`

`.docx` is a zipped OOXML format; parsing it well (styles, nested lists,
images) is a meaningfully larger problem than the rest of this exercise
combined. `.txt`/`.md` cover the "upload a file, turn it into an editable
document" requirement with a small, auditable converter (~60 lines, no
external Markdown dependency) that I could verify manually rather than
trust blindly. This is stated clearly in both the README and the upload
button in the UI, per the brief's instruction to be explicit about
supported types.

### 5. Autosave over an explicit "Save" button

Content saves via a debounced PUT (800ms after the last edit) rather
than a manual save button. This matches the Google Docs-like feel the
brief asks for ("the editing flow should feel usable and coherent") and
sidesteps a whole class of "did I lose my edits" bugs a manual save
button invites under a time-boxed build.

### 6. What I deliberately did not build

- **Real-time collaboration** (multi-cursor, live co-editing): the brief
  lists this as an *optional* stretch goal and explicitly warns not to
  sacrifice core functionality for it. A correct real-time layer (OT or
  CRDT plus WebSocket transport) is a substantial project on its own;
  attempting a shallow version risked data-loss bugs on the core
  save/persist path, which is not an acceptable trade.
- **Version history / undo past refresh**: same reasoning — listed as
  optional stretch, cut to protect time for the required core.
- **Granular roles beyond view/edit**: two permission levels are enough
  to demonstrate the access-control logic the brief asks for without
  building a permissions system that's disproportionate to the app.

## Data model

```
users(id, name, email)
documents(id, owner_id, title, content[html], created_at, updated_at)
shares(id, document_id, user_id, permission['view'|'edit'])
```

`shares` is a simple join table with a `UNIQUE(document_id, user_id)`
constraint, so re-sharing with someone just upgrades/downgrades their
permission (`ON CONFLICT ... DO UPDATE`) instead of creating duplicate
rows.

## Testing

One automated test suite (`server/src/__tests__/documents.test.js`,
Jest + Supertest) covers the sharing/permission logic specifically,
since that's the piece of business logic most likely to have a subtle
bug (and the piece the brief calls out as something to demonstrate
"working logic" for) — not just CRUD happy paths. It runs against a
disposable Postgres schema (dropped and recreated at the start of
each test run) so it never touches real dev/production data.

# Collab Docs

A lightweight collaborative document editor (Google-Docs-inspired), built
as a scoped full-stack take-home. Users can create and edit rich-text
documents, upload `.txt`/`.md` files to convert into new documents, and
share documents with other seeded users at `view` or `edit` permission.

## Stack

- **Backend:** Node.js, Express, Postgres (via `pg`) — a managed cloud
  database (e.g. [Neon](https://neon.tech)), not a local file, so data
  isn't tied to the app server's disk
- **Frontend:** React (Vite), [Tiptap](https://tiptap.dev) rich-text editor, React Router
- **Auth:** Mocked — no passwords. You "log in" by picking one of three
  seeded demo accounts. See `ARCHITECTURE.md` for why.
- **Tests:** Jest + Supertest, covering document sharing / access control

## Project layout

```
collab-doc-editor/
  server/     Express API + Postgres persistence
  client/     React (Vite) frontend
```

## Running locally

Requires Node.js 18+.

### 1. Backend

```bash
cd server
npm install
npm run dev        # starts on http://localhost:4000
```

The server needs a `DATABASE_URL` pointing at a Postgres database. For
local development, the quickest options are:

- A free [Neon](https://neon.tech) project (same one you'd use for
  deployment — see `DEPLOYMENT.md`), or
- A local Postgres instance: `createdb collabdocs_dev`, then
  `DATABASE_URL=postgres://localhost/collabdocs_dev`

Create `server/.env` (or export the variable in your shell):

```
DATABASE_URL=postgres://user:password@host/dbname
```

Schema and seed data (three demo users, one example shared document)
are created automatically on first boot — no manual SQL required.

### 2. Frontend

In a second terminal:

```bash
cd client
npm install
npm run dev         # starts on http://localhost:5173
```

The client reads the API base URL from `client/.env`
(`VITE_API_BASE=http://localhost:4000` by default).

### 3. Try it out

Open http://localhost:5173, pick "Alice Chen" (or any seeded user), and:

- Open the pre-seeded "Welcome to Collab Docs" document
- Create a new document and try bold / italic / underline / headings / lists
- Upload the included `server/sample-files` (or any `.txt`/`.md` file) to
  import it as a new document
- Click **Share**, grant "Bob Martinez" access, then switch users (top
  right) and log in as Bob to see it under "Shared with me"
- Try granting **view-only** access and confirm the toolbar disables for
  the viewer
- Try granting **comment-only** access instead — the recipient can view
  and post comments but still can't edit content
- Click **Comments** to open the comment thread on a document
- Click **History** to see saved snapshots and restore an earlier one
  (snapshots are throttled to once per 5 minutes per document, so you
  won't see one on a document you just created)
- Click **Export .md** or **Export PDF** to download the document
- Open the same document as two different users (e.g. two browser
  windows) — each user shows up as a small avatar in the top bar on the
  other's screen within a few seconds (real-time presence, polling-based)

## Optional stretch features

All five suggested stretch enhancements are implemented: real-time
presence indicators, commenting, version history, PDF/Markdown export,
and a third `comment` sharing tier. Each was deliberately scoped to a
smaller, real version rather than a shallow imitation of the full
feature — see the "Stretch features" section in `ARCHITECTURE.md` for
exactly how and why.

## Running tests

```bash
cd server
npm test
```

Tests run against a real Postgres database so the sharing/permission
logic is verified against actual query behavior, not a mock. Point
`TEST_DATABASE_URL` at a scratch database (it drops and recreates the
schema on every run, so never point it at your dev or production
database):

```bash
TEST_DATABASE_URL=postgres://localhost/collabdocs_test npm test
```

18 tests total: 10 covering the core sharing/upload flows, 8 covering
the stretch features (comment-tier permissions, version restore, both
export formats, and presence).

## Seeded accounts

No credentials needed — click a name on the login screen:

| Name          | Email               |
|---------------|----------------------|
| Alice Chen    | alice@example.com   |
| Bob Martinez  | bob@example.com     |
| Carol Singh   | carol@example.com   |

Alice's account starts with one document already shared with Bob, so the
sharing flow has something to demonstrate on first load.

## Supported file uploads

Only **`.txt`** and **`.md`** files are supported, capped at 2MB. This is
stated in the upload button label in the UI. Markdown headings, bold,
italic, and lists are converted to the equivalent rich-text formatting;
plain text is split into paragraphs. `.docx` import was explicitly cut —
see `ARCHITECTURE.md`.

## Known limitations / what's incomplete

- No real-time collaborative editing (last-write-wins on save, not
  simultaneous multi-cursor editing) — see `ARCHITECTURE.md` for why this
  was deprioritized.
- No document version history or undo-past-refresh.
- No password-based auth — mocked user switching only.
- `.docx` upload is not supported, only `.txt`/`.md`.
- No pagination on the document list (fine at demo scale).

With another 2-4 hours, next priorities would be: real .docx import via
mammoth.js, a "last edited by" attribution on shared docs, and basic
optimistic-locking (or a CRDT) so two simultaneous editors don't silently
clobber each other.

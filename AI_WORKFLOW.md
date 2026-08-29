# AI Workflow Note

## Tools used

- **Claude** (Anthropic) as the primary AI pair-programmer for this
  assignment — used conversationally to scaffold the backend and
  frontend, generate the test suite, and draft this documentation.

## Where AI materially sped up the work

- **Boilerplate and scaffolding**: Express app structure, route files,
  Vite/React setup, and Tiptap integration wiring were generated quickly,
  freeing time for the parts that needed actual judgment — the
  permission model and scope decisions.
- **The Markdown-to-HTML converter for file upload**: rather than pull in
  a full Markdown parser dependency for a narrow need (headings, bold,
  italic, lists only), AI drafted a small purpose-built converter that
  covers exactly the formatting the editor supports.
- **Test scaffolding**: the Jest/Supertest suite structure (disposable
  SQLite file per run, request helpers) was generated fast, letting me
  focus review time on whether the test *cases* were the right ones,
  not on test plumbing.
- **Documentation drafts**: this file, the README, and the architecture
  note were drafted by AI from the actual decisions made during the
  build, then reviewed for accuracy against the real code.

## What I changed or rejected from AI output

- **Multer version**: the AI's first pass pinned `multer@^1.4.5-lts.1`,
  which `npm install` flagged as having known vulnerabilities. I had it
  upgrade to `multer@^2.x` and re-verified the upload route still worked
  against the new API before accepting it.
- **Permission model shape**: the AI's first draft of the sharing route
  didn't distinguish `view` vs `edit` permissions server-side (only
  UI-level hiding). I pushed back and had it move the check into the
  route handler itself (`access === 'view'` → 403 on write), since a
  permission that's only enforced in the UI isn't really enforced. That
  version is what's tested.
- **Scope cuts**: real-time collaboration and version history were
  suggested as possible stretch additions; I rejected both to protect
  time for hardening the core flows (upload edge cases, permission
  checks, error handling), consistent with the brief's own warning not
  to sacrifice core functionality for optional stretch work.
- **Storage layer**: the first working version used SQLite for
  zero-setup local persistence. Before deploying, I had it migrated to a
  managed Postgres database (Neon) instead, since SQLite as a file on
  the app server's own disk is fragile under Render's free-tier
  redeploy/restart behavior — for something a reviewer will actually
  click days later, I wanted persistence that doesn't depend on the app
  container's disk at all. I verified this by killing and restarting
  both the database service and the Node process locally and confirming
  previously-created documents were still there afterward, rather than
  trusting the migration on inspection alone.

## How I verified correctness, UX quality, and reliability

- **Ran the full test suite** (`npm test` in `server/`) and confirmed all
  5 sharing/permission tests pass before treating that logic as done.
- **Manually smoke-tested the API with curl** end-to-end: health check,
  user listing, document creation, `.md` file upload (confirmed the
  converted HTML was correct), sharing a document as `view`-only, and
  confirming the recipient got a 403 on a write attempt.
- **Built the frontend** (`npm run build`) to catch compile-time errors
  before treating the UI as done, rather than trusting generated JSX on
  sight.
- **Read every generated file** rather than accepting output wholesale —
  in particular the access-control logic in `documents.js`, since that's
  the part of the app most likely to hide a subtle bug that only shows
  up when two users interact with the same document.

AI usage here was about speed on well-understood boilerplate (routing,
scaffolding, test plumbing) so more time could go to the decisions that
actually needed a human judgment call: what to cut, how strict the
permission model should be, and whether the converted output was
actually correct — not just plausible-looking.

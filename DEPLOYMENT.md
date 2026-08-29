# Deployment Guide (Neon Postgres + Render)

The app is now fully cloud-based: a managed Postgres database (not a
file on the app server's disk) plus a stateless API container and a
static frontend. Any reviewer hitting the live URL gets the same shared
data — nothing depends on your machine.

**Why Neon and not Render's own free Postgres:** Render's free Postgres
tier auto-deletes after a limited time (it's meant for short-lived
testing, not something you can leave live for a reviewer to click days
later). Neon's free tier has no such expiry — the database just sits
there; the compute goes to sleep after inactivity and wakes on the next
query (a few seconds' delay), but the data and the database itself never
get deleted. Supabase is an equally valid free alternative if you'd
rather use that instead — either satisfies the brief's own list of
acceptable stores ("SQLite, Postgres, Supabase").

## 1. Create a free Postgres database (Neon)

1. Go to [neon.tech](https://neon.tech) → sign up (GitHub login is
   fastest) → **Create a project**.
2. Once created, copy the **connection string** shown on the dashboard.
   It looks like:
   ```
   postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require
   ```
   That whole string is your `DATABASE_URL`.

You don't need to run any SQL yourself — the server creates its own
schema and seed data automatically on first boot (`server/src/db.js`).

## 2. Push to GitHub

```bash
cd collab-doc-editor
git init
git add .
git commit -m "Collab Docs - AI-native full stack assignment"
git remote add origin https://github.com/<your-username>/collab-doc-editor.git
git branch -M main
git push -u origin main
```

## 3. Deploy the backend (Render Web Service)

[render.com](https://render.com) → **New +** → **Web Service** → connect
your repo.

| Setting | Value |
|---|---|
| Root Directory | `server` |
| Environment | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

Add one environment variable:

| Key | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string from step 1 |

Deploy, then confirm it's alive and the schema bootstrapped correctly:

```bash
curl https://<your-backend>.onrender.com/api/health
# -> {"ok":true}
curl https://<your-backend>.onrender.com/api/users
# -> should list Alice, Bob, Carol - proves it connected to Neon and seeded
```

## 4. Deploy the frontend (Render Static Site)

**New +** → **Static Site** → same repo.

| Setting | Value |
|---|---|
| Root Directory | `client` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

Environment variable:

| Key | Value |
|---|---|
| `VITE_API_BASE` | your backend URL from step 3, no trailing slash |

## 5. Verify the full live flow

On the **live frontend URL** (not localhost):

- [ ] Login screen lists the 3 seeded users
- [ ] Log in as Alice, see "Welcome to Collab Docs"
- [ ] Create a document, format text, refresh — it persists
- [ ] Upload a `.txt`/`.md` file (samples in `server/sample-files/`)
- [ ] Share a doc with Bob (edit), switch users, see it under "Shared with me"
- [ ] Share a different doc as view-only, confirm Bob's toolbar disables
- [ ] Delete a document as its owner
- [ ] **Open the same live URL from a different browser/device (or ask a
      friend to)** and confirm they see the same data — this is the real
      proof it's cloud-based and not tied to your machine

Two things worth expecting, not worrying about:
- **Render free web service** spins down after ~15 min idle, takes
  30-60s to wake on the next request.
- **Neon free compute** similarly suspends after inactivity and
  auto-resumes on the next query, adding a few seconds to the first
  request after a quiet period.

Mention both briefly in your walkthrough video so a reviewer isn't
confused by a slow first load — it's expected free-tier behavior, not a
bug.

## 6. Fill in the URLs

Update `SUBMISSION.md` with the live frontend URL and, once recorded,
the walkthrough video link.

// Runs against a real local Postgres database (set via TEST_DATABASE_URL,
// falling back to a sensible local default) rather than mocking the DB
// layer - the sharing/permission logic here is exactly the kind of thing
// that looks right against a mock and breaks against a real query planner
// (e.g. NULL handling, UNIQUE constraint behavior on upsert).
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/collabdocs_test";

const { pool, init } = require("../db");
const request = require("supertest");
const app = require("../app");

beforeAll(async () => {
  // Start every test run from a clean, known schema so tests are
  // repeatable and don't depend on leftover state from a previous run.
  await pool.query("DROP TABLE IF EXISTS shares, documents, users CASCADE");
  await init();
});

afterAll(async () => {
  await pool.end();
});

describe("document sharing & access control", () => {
  let aliceId, bobId, carolId;
  let docId;

  beforeAll(async () => {
    const users = await request(app).get("/api/users");
    aliceId = users.body.find((u) => u.name.startsWith("Alice")).id;
    bobId = users.body.find((u) => u.name.startsWith("Bob")).id;
    carolId = users.body.find((u) => u.name.startsWith("Carol")).id;
  });

  test("a user with no relationship to a document cannot read it", async () => {
    const created = await request(app)
      .post("/api/documents")
      .set("x-user-id", aliceId)
      .send({ title: "Alice's private doc" });
    docId = created.body.id;

    const res = await request(app)
      .get(`/api/documents/${docId}`)
      .set("x-user-id", carolId);

    expect(res.status).toBe(403);
  });

  test("owner can grant view-only access, and a viewer cannot edit", async () => {
    const share = await request(app)
      .post(`/api/documents/${docId}/shares`)
      .set("x-user-id", aliceId)
      .send({ userId: bobId, permission: "view" });
    expect(share.status).toBe(201);

    const readAsBob = await request(app)
      .get(`/api/documents/${docId}`)
      .set("x-user-id", bobId);
    expect(readAsBob.status).toBe(200);
    expect(readAsBob.body.access).toBe("view");

    const editAsBob = await request(app)
      .put(`/api/documents/${docId}`)
      .set("x-user-id", bobId)
      .send({ content: "<p>hacked</p>" });
    expect(editAsBob.status).toBe(403);
  });

  test("upgrading a share to edit permission allows writes", async () => {
    await request(app)
      .post(`/api/documents/${docId}/shares`)
      .set("x-user-id", aliceId)
      .send({ userId: bobId, permission: "edit" });

    const editAsBob = await request(app)
      .put(`/api/documents/${docId}`)
      .set("x-user-id", bobId)
      .send({ content: "<p>updated by bob</p>" });

    expect(editAsBob.status).toBe(200);
    expect(editAsBob.body.content).toBe("<p>updated by bob</p>");
  });

  test("only the owner can modify sharing, not a shared editor", async () => {
    const res = await request(app)
      .post(`/api/documents/${docId}/shares`)
      .set("x-user-id", bobId) // Bob has edit access but is not the owner
      .send({ userId: carolId, permission: "view" });

    expect(res.status).toBe(403);
  });

  test("shared documents show up in the recipient's 'shared' list, not 'owned'", async () => {
    const res = await request(app)
      .get("/api/documents")
      .set("x-user-id", bobId);

    const sharedIds = res.body.shared.map((d) => d.id);
    const ownedIds = res.body.owned.map((d) => d.id);
    expect(sharedIds).toContain(docId);
    expect(ownedIds).not.toContain(docId);
  });

  test("a shared editor cannot delete the document, only the owner can", async () => {
    const asBob = await request(app)
      .delete(`/api/documents/${docId}`)
      .set("x-user-id", bobId);
    expect(asBob.status).toBe(403);

    const asAlice = await request(app)
      .delete(`/api/documents/${docId}`)
      .set("x-user-id", aliceId);
    expect(asAlice.status).toBe(204);
  });

  test("clearing a document's title falls back to a default instead of saving blank", async () => {
    const created = await request(app)
      .post("/api/documents")
      .set("x-user-id", aliceId)
      .send({ title: "Has a title" });

    const updated = await request(app)
      .put(`/api/documents/${created.body.id}`)
      .set("x-user-id", aliceId)
      .send({ title: "   " });

    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Untitled document");
  });
});

describe("file upload validation", () => {
  let aliceId;
  beforeAll(async () => {
    const users = await request(app).get("/api/users");
    aliceId = users.body.find((u) => u.name.startsWith("Alice")).id;
  });

  test("rejects an unsupported file type", async () => {
    const res = await request(app)
      .post("/api/upload")
      .set("x-user-id", aliceId)
      .attach("file", Buffer.from("not really a pdf"), "notes.pdf");

    expect(res.status).toBe(400);
  });

  test("converts a markdown upload into HTML with headings, bold, and lists", async () => {
    const md = "# Title\n\nSome **bold** text.\n\n- one\n- two\n";
    const res = await request(app)
      .post("/api/upload")
      .set("x-user-id", aliceId)
      .attach("file", Buffer.from(md), "notes.md");

    expect(res.status).toBe(201);
    expect(res.body.content).toContain("<h1>Title</h1>");
    expect(res.body.content).toContain("<strong>bold</strong>");
    expect(res.body.content).toContain("<li>one</li>");
  });

  test("rejects a file over the 2MB size limit", async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, "a");
    const res = await request(app)
      .post("/api/upload")
      .set("x-user-id", aliceId)
      .attach("file", big, "huge.txt");

    expect(res.status).toBe(400);
  });
});

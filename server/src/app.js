// app.js - Express app wiring, separated from index.js so tests can
// import the app without also binding a live port.

const express = require("express");
const cors = require("cors");

const usersRouter = require("./routes/users");
const documentsRouter = require("./routes/documents");
const uploadRouter = require("./routes/upload");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/users", usersRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/upload", uploadRouter);

// Central error handler - catches anything thrown/rejected in routes
// (including multer errors that escape the inline handler) so the API
// never leaks a raw stack trace to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

module.exports = app;

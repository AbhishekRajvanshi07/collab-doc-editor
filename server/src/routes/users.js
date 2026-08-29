const express = require("express");
const { pool } = require("../db");

const router = express.Router();

// GET /api/users - list all seeded users. Used for the login screen and
// the "share with" picker on the frontend. No auth required to view this
// list since it's just the mocked directory of demo accounts.
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT id, name, email FROM users ORDER BY id");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

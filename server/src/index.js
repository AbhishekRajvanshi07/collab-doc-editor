// Loads server/.env for local development. In production (Render etc.)
// DATABASE_URL is set directly as a platform env var, and dotenv is a
// harmless no-op if no .env file exists.
require("dotenv").config();

const app = require("./app");
const { init } = require("./db");

const PORT = process.env.PORT || 4000;

// Run schema/seed bootstrap before accepting traffic, so the very first
// request never races an empty database.
init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Collab doc server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

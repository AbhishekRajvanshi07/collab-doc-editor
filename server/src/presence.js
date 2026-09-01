// presence.js — lightweight "who's currently viewing this document"
// tracker, backing the real-time collaboration indicator stretch
// feature. Deliberately in-memory rather than a Postgres table:
// presence is inherently transient (a user who closed their tab 20
// seconds ago shouldn't still show up after a server restart anyway),
// and polling an in-memory map avoids a database write on every
// heartbeat. This trades multi-instance correctness for simplicity -
// fine for a single Render instance; a horizontally-scaled deployment
// would need Redis or similar to share presence across instances.
//
// This is polling-based (the client pings every few seconds), not a
// WebSocket push. That's a deliberate scope cut: real-time *indicators*
// (who's here) don't need a persistent connection, and building full
// WebSocket infrastructure for that alone would be disproportionate to
// what it demonstrates - see ARCHITECTURE.md.

const HEARTBEAT_TTL_MS = 12000; // a user counts as "active" for 12s after their last ping

// Map<documentId, Map<userId, { id, name, lastSeen }>>
const presenceByDoc = new Map();

function ping(documentId, user) {
  if (!presenceByDoc.has(documentId)) presenceByDoc.set(documentId, new Map());
  presenceByDoc.get(documentId).set(user.id, { id: user.id, name: user.name, lastSeen: Date.now() });
}

function getActiveUsers(documentId, excludeUserId) {
  const doc = presenceByDoc.get(documentId);
  if (!doc) return [];
  const now = Date.now();
  const active = [];
  for (const [userId, entry] of doc) {
    if (now - entry.lastSeen > HEARTBEAT_TTL_MS) {
      doc.delete(userId);
      continue;
    }
    if (userId === excludeUserId) continue;
    active.push({ id: entry.id, name: entry.name });
  }
  return active;
}

module.exports = { ping, getActiveUsers };

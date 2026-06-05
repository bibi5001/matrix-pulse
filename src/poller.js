const https = require("https");
const http = require("http");

const POLL_INTERVAL_MS = parseInt(process.env.PRESENCE_POLL_INTERVAL_MS ?? "15000", 10);

/**
 * Polls the Matrix homeserver for presence status of all tracked users.
 *
 * Matrix presence endpoint:
 *   GET /_matrix/client/v3/presence/{userId}/status
 *
 * We poll instead of using sync events because:
 *   1. Presence events are often delayed or batched in sync
 *   2. The bot may not be in all rooms the users are in
 *   3. Direct polling is more reliable for this use case
 */
function startPresencePoller(matrixClient, store) {
  console.log(`[Poller] Starting presence poller (interval: ${POLL_INTERVAL_MS}ms)`);

  // Initial discovery: find all users in joined rooms
  setTimeout(() => {
    discoverUsers(matrixClient, store);
    pollPresence(matrixClient, store);
  }, 3000); // wait for sync to be ready

  // Periodic discovery + poll
  setInterval(() => {
    discoverUsers(matrixClient, store);
    pollPresence(matrixClient, store);
  }, POLL_INTERVAL_MS);
}

/**
 * Scans all joined rooms and adds their members to the tracked users list.
 */
function discoverUsers(matrixClient, store) {
  const rooms = matrixClient.getRooms();
  let count = 0;

  for (const room of rooms) {
    const members = room.getJoinedMembers();
    const userIds = members.map((m) => m.userId);
    store.addTrackedUsers(userIds);
    count += userIds.length;
  }

  const total = store.getTrackedUsers().length;
  console.log(`[Poller] Discovered users across ${rooms.length} rooms. Tracking ${total} unique users.`);
}

/**
 * Fetches presence for all tracked users and updates the store.
 */
async function pollPresence(matrixClient, store) {
  const users = store.getTrackedUsers();
  if (users.length === 0) return;

  // Fetch in parallel but cap concurrency to avoid flooding the homeserver
  const BATCH_SIZE = 20;
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map((userId) => fetchAndStorePresence(matrixClient, store, userId))
    );
  }
}

async function fetchAndStorePresence(matrixClient, store, userId) {
  try {
    // matrix-js-sdk exposes getPresence
    const result = await matrixClient.getPresence(userId);
    store.setPresence(userId, result);
  } catch (err) {
    // 403: presence disabled or user on different server
    // 404: user not found
    if (err?.httpStatus !== 403 && err?.httpStatus !== 404) {
      console.warn(`[Poller] Failed to fetch presence for ${userId}: ${err?.message}`);
    }
    // For users we can't reach, set offline
    store.setPresence(userId, { presence: "offline" });
  }
}

module.exports = { startPresencePoller };

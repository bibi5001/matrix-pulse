require("dotenv").config();
const { createApp } = require("./api");
const { createMatrixClient } = require("./matrix");
const { PresenceStore } = require("./store");
const { startPresencePoller } = require("./poller");

const PORT = process.env.PORT || 3000;

async function main() {
  console.log("[PULSE] Starting Matrix Presence Bot...");

  // Shared in-memory store
  const store = new PresenceStore();

  // Connect Matrix client
  const matrixClient = await createMatrixClient(store);

  // Start presence polling loop
  startPresencePoller(matrixClient, store);

  // Start HTTP API
  const app = createApp(store);
  app.listen(PORT, () => {
    console.log(`[PULSE] API listening on http://0.0.0.0:${PORT}`);
  });
}

main().catch((err) => {
  console.error("[PULSE] Fatal error:", err);
  process.exit(1);
});

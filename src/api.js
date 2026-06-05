const express = require("express");
const cors = require("cors");
const path = require("path");

/**
 * REST API endpoints:
 *
 *   GET /api/presence          – all tracked users (presence + call status)
 *   GET /api/presence/:userId  – single user
 *   GET /api/calls             – all users currently in a call
 *   GET /api/health            – health check
 *   GET /widget                – serves the presence widget HTML
 */
function createApp(store) {
  const app = express();

  // CORS: restrict to configured origin in production
  const allowedOrigin = process.env.WIDGET_ORIGIN ?? "*";
  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json());

  // --- Static widget ---
  app.use("/widget", express.static(path.join(__dirname, "../widget")));

  // --- Health check ---
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      trackedUsers: store.getTrackedUsers().length,
      timestamp: new Date().toISOString(),
    });
  });

  // --- Presence: all users ---
  app.get("/api/presence", (req, res) => {
    // Optional ?users=@alice:matrix.org,@bob:matrix.org filter
    const filterParam = req.query.users;
    const filterList = filterParam
      ? filterParam.split(",").map((u) => u.trim())
      : null;

    const snapshot = store.getSnapshot(filterList);
    res.json(snapshot);
  });

  // --- Presence: single user ---
  app.get("/api/presence/:userId", (req, res) => {
    const userId = decodeURIComponent(req.params.userId);
    const snapshot = store.getSnapshot([userId]);
    const user = snapshot[userId];

    if (!user) {
      return res.status(404).json({ error: "User not found or not tracked." });
    }

    res.json(user);
  });

  // --- Call status: all users in a call ---
  app.get("/api/calls", (req, res) => {
    res.json(store.getUsersInCall());
  });

  return app;
}

module.exports = { createApp };

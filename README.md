# PULSE – Matrix Presence & Call Widget

> **Discord-like presence awareness for self-hosted Matrix / Element**

A lightweight backend bot that tracks online/away/offline status and active voice calls for your Matrix community — and serves a zero-login widget you can embed directly in Element.

---

## Features

- **Real-time presence** — Online / Away / Do Not Disturb / Offline with colored status dots
- **Call detection** — shows who is currently in an Element Call (MSC3401 / `org.matrix.msc3401.call.member`)
- **Audio feedback** — Discord-style tones when members come online or go offline
- **No login required** — widget reads from the bot's API, users don't need to enter any token
- **Self-hosted** — runs as a single Docker container, connects to your Synapse server
- **Zero external dependencies** — no Jitsi, no third-party services

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Docker host                                 │
│                                              │
│  ┌──────────┐    Matrix sync    ┌─────────┐  │
│  │  Synapse │ ◄──────────────── │ PULSE │  │
│  │ (Matrix) │                   │         │  │
│  └──────────┘   REST API        │  :3000  │  │
│                                 └────┬────┘  │
│  ┌──────────┐                        │       │
│  │  Caddy   │ ─── /pulse/* ────────────┘       │
│  │  (proxy) │                                │
│  └──────────┘                                │
│       ▲                                      │
└───────┼──────────────────────────────────────┘
        │ HTTPS
   ┌────┴────┐
   │ Element │  ← widget iframe: /pulse/widget/
   │  (user) │
   └─────────┘
```

**Bot flow:**
1. Bot logs in with a dedicated Matrix account (minimal permissions)
2. Syncs joined rooms to discover all members
3. Polls `/_matrix/client/v3/presence/{userId}/status` every 15 s
4. Listens for `org.matrix.msc3401.call.member` state events for call detection
5. Exposes everything via a simple REST API

---

## Quick Start

### 1. Create the bot account

On your Synapse server, register a bot user (or use the Admin API):

```bash
register_new_matrix_user -c /etc/matrix-synapse/homeserver.yaml \
  -u pulse-bot -p 'STRONG_PASSWORD' --no-admin
```

Get an access token:

```bash
curl -XPOST 'https://matrix.example.com/_matrix/client/v3/login' \
  -H 'Content-Type: application/json' \
  -d '{"type":"m.login.password","user":"pulse-bot","password":"STRONG_PASSWORD"}'
```

Copy the `access_token` from the response.

### 2. Invite the bot to your rooms

The bot must be in a room to see its members' presence.

```
/invite @pulse-bot:example.com
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Start

```bash
docker compose up -d
```

The API is now available at `http://localhost:3001/api/health`.

---

## Embedding the Widget in Element

In Element Web, open **Room Settings → Widgets → Add widget** (or use the integration manager):

| Field | Value |
|-------|-------|
| Widget URL | `https://element.example.com/pulse/widget/?api=https://element.example.com/pulse` |
| Name | PULSE Presence |

Or use the `/addwidget` command:

```
/addwidget https://element.example.com/pulse/widget/?api=https://element.example.com/pulse
```

### Widget query parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `api` | same origin | Base URL of the PULSE API |
| `poll` | `12000` | Refresh interval in ms |
| `audio` | `1` | Set to `0` to disable audio feedback |

---

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check + stats |
| `GET /api/presence` | All tracked users with presence + call status |
| `GET /api/presence/:userId` | Single user (URL-encode the MXID) |
| `GET /api/calls` | All users currently in a voice call |
| `GET /widget/` | Serves the presence widget |

### Example response – `/api/presence`

```json
{
  "@alice:example.com": {
    "userId": "@alice:example.com",
    "presence": "online",
    "statusMsg": null,
    "lastActiveAgo": 4200,
    "currentlyActive": true,
    "lastUpdated": "2024-01-15T14:23:00.000Z",
    "call": {
      "inCall": true,
      "roomId": "!abcdef:example.com",
      "since": "2024-01-15T14:20:00.000Z"
    }
  },
  "@bob:example.com": {
    "userId": "@bob:example.com",
    "presence": "unavailable",
    "statusMsg": "In a meeting",
    "lastActiveAgo": 180000,
    "currentlyActive": false,
    "lastUpdated": "2024-01-15T14:19:00.000Z",
    "call": { "inCall": false, "roomId": null, "since": null }
  }
}
```

---

## Caddy Configuration

See `docs/caddy-snippet.txt` for a ready-to-use reverse proxy config.

---

## Presence Caveats

Matrix presence has some limitations you should know:

- **Federation**: presence of users on remote servers may not be visible, depending on the federation configuration of both servers.
- **Synapse config**: presence must be enabled in `homeserver.yaml` (`presence: enabled: true`). It is enabled by default.
- **Privacy**: some clients allow users to hide their presence. The bot respects this — hidden users appear as offline.

---

## Call Detection (MSC3401)

Call detection relies on the `org.matrix.msc3401.call.member` state event, which is the native Element Call mechanism. This works out of the box with Element Web ≥ 1.11 when Element Call is used as the VoIP backend.

Jitsi-based calls (older Element versions) are **not** detected — this is intentional, as the project targets the current/future Matrix VoIP stack.

---

## Development

```bash
# Install dependencies
npm install

# Run with auto-reload
npm run dev

# The API runs at http://localhost:3000
```

---

## Contributing

Issues and PRs welcome. This project fills a real gap in the Matrix ecosystem — if you run a self-hosted community, you know the pain.

---

## License

MIT

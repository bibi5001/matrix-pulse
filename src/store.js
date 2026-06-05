/**
 * PresenceStore – in-memory state for all tracked users.
 *
 * Presence data structure:
 * {
 *   userId: {
 *     presence: "online" | "unavailable" | "offline",
 *     statusMsg: string | null,
 *     lastActiveAgo: number | null,   // ms
 *     currentlyActive: boolean,
 *     lastUpdated: ISO timestamp
 *   }
 * }
 *
 * Call data structure:
 * {
 *   userId: {
 *     inCall: boolean,
 *     roomId: string | null,
 *     callData: object | null,
 *     since: ISO timestamp | null
 *   }
 * }
 */
class PresenceStore {
  constructor() {
    this._presence = new Map(); // userId -> presence object
    this._calls = new Map();    // userId -> call object
    this._trackedUsers = new Set();
  }

  // --- Presence ---

  setPresence(userId, data) {
    const previous = this._presence.get(userId);
    const now = new Date().toISOString();

    this._presence.set(userId, {
      presence: data.presence ?? "offline",
      statusMsg: data.status_msg ?? null,
      lastActiveAgo: data.last_active_ago ?? null,
      currentlyActive: data.currently_active ?? false,
      lastUpdated: now,
    });

    // Return whether the presence state actually changed (for change events)
    return previous?.presence !== (data.presence ?? "offline");
  }

  getPresence(userId) {
    return this._presence.get(userId) ?? {
      presence: "offline",
      statusMsg: null,
      lastActiveAgo: null,
      currentlyActive: false,
      lastUpdated: null,
    };
  }

  // --- Call status ---

  setCallStatus(userId, roomId, callData) {
    const inCall = callData !== null && Object.keys(callData).length > 0;
    const existing = this._calls.get(userId);

    this._calls.set(userId, {
      inCall,
      roomId: inCall ? roomId : null,
      callData: inCall ? callData : null,
      since: inCall ? (existing?.since ?? new Date().toISOString()) : null,
    });
  }

  getCallStatus(userId) {
    return this._calls.get(userId) ?? {
      inCall: false,
      roomId: null,
      callData: null,
      since: null,
    };
  }

  // --- Tracked users ---

  addTrackedUser(userId) {
    this._trackedUsers.add(userId);
  }

  addTrackedUsers(userIds) {
    for (const id of userIds) this._trackedUsers.add(id);
  }

  getTrackedUsers() {
    return Array.from(this._trackedUsers);
  }

  // --- Combined snapshot ---

  /**
   * Returns a full snapshot of all tracked users with presence + call status.
   * Optionally filtered by a list of userIds.
   */
  getSnapshot(filterUserIds = null) {
    const users = filterUserIds ?? this.getTrackedUsers();
    const result = {};

    for (const userId of users) {
      result[userId] = {
        userId,
        ...this.getPresence(userId),
        call: this.getCallStatus(userId),
      };
    }

    return result;
  }

  /**
   * Returns all users currently in a call.
   */
  getUsersInCall() {
    const result = {};
    for (const [userId, callData] of this._calls.entries()) {
      if (callData.inCall) {
        result[userId] = {
          userId,
          ...callData,
        };
      }
    }
    return result;
  }
}

module.exports = { PresenceStore };

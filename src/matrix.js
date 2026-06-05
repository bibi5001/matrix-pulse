const sdk = require("matrix-js-sdk");

/**
 * Creates and starts the Matrix bot client.
 * The bot joins rooms and listens for call state events (MSC3401).
 */
async function createMatrixClient(store) {
  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  const accessToken = process.env.MATRIX_BOT_ACCESS_TOKEN;
  const botUserId = process.env.MATRIX_BOT_USER_ID;

  if (!homeserverUrl || !accessToken || !botUserId) {
    throw new Error(
      "Missing required env vars: MATRIX_HOMESERVER_URL, MATRIX_BOT_ACCESS_TOKEN, MATRIX_BOT_USER_ID"
    );
  }

  const client = sdk.createClient({
    baseUrl: homeserverUrl,
    accessToken,
    userId: botUserId,
    // No persistent store needed – we rebuild from sync on start
    store: new sdk.MemoryStore(),
  });

  // Listen for call member events (MSC3401 / Element Call)
  // These are state events of type "org.matrix.msc3401.call.member"
  client.on(sdk.RoomStateEvent.Members, (event, state, member) => {
    // handled below via specific event type
  });

  client.on(sdk.RoomEvent.Timeline, (event) => {
    if (event.getType() === "org.matrix.msc3401.call.member") {
      handleCallMemberEvent(event, store);
    }
  });

  // State events (current call participants on room join)
  client.on(sdk.RoomStateEvent.NewMember, (event, state, member) => {
    handleCallStateEvent(event, store);
  });

  client.on(sdk.ClientEvent.Sync, (syncState) => {
    if (syncState === "PREPARED") {
      console.log("[Matrix] Sync ready. Scanning joined rooms for call state...");
      scanRoomsForCallState(client, store);
    }
  });

 // Auto-join on invite
 client.on(sdk.RoomMemberEvent.Membership, async (event, member) => {
   if (member.membership === "invite" && member.userId === botUserId) {
     console.log(`[Matrix] Auto-joining room: ${member.roomId}`);
     try {
       await client.joinRoom(member.roomId);
       console.log(`[Matrix] Joined room: ${member.roomId}`);
     } catch (err) {
       console.error(`[Matrix] Failed to join room ${member.roomId}:`, err.message);
     }
   }
 });

  // Also handle raw state events during sync
  client.on(sdk.RoomStateEvent.Events, (event, state, prevEvent) => {
    if (event.getType() === "org.matrix.msc3401.call.member") {
      handleCallMemberEvent(event, store);
    }
  });

  console.log("[Matrix] Starting sync...");
  await client.startClient({ initialSyncLimit: 50 });

  return client;
}

/**
 * Parses a call.member state event and updates the store.
 * Content structure per MSC3401:
 * {
 *   "org.matrix.msc3401.call.member": {
 *     "device_id": { "session_id": "...", "feeds": [...], ... }
 *   }
 * }
 */
function handleCallMemberEvent(event, store) {
  const userId = event.getSender() || event.getStateKey();
  const roomId = event.getRoomId();
  const content = event.getContent();

  // If content is empty or has no call keys, user left all calls
  const callKeys = Object.keys(content).filter((k) =>
    k.startsWith("org.matrix.msc3401.call") || k === "calls"
  );

  const isInCall = callKeys.length > 0 && Object.keys(content).length > 0;

  store.setCallStatus(userId, roomId, isInCall ? content : null);
  console.log(`[Call] ${userId} in ${roomId}: ${isInCall ? "IN CALL" : "left"}`);
}

function handleCallStateEvent(event, store) {
  if (event && event.getType && event.getType() === "org.matrix.msc3401.call.member") {
    handleCallMemberEvent(event, store);
  }
}

/**
 * On initial sync, scan all rooms the bot has joined for existing call state.
 */
function scanRoomsForCallState(client, store) {
  const rooms = client.getRooms();
  for (const room of rooms) {
    const callMemberEvents = room.currentState.getStateEvents(
      "org.matrix.msc3401.call.member"
    );
    if (callMemberEvents) {
      const events = Array.isArray(callMemberEvents)
        ? callMemberEvents
        : [callMemberEvents];
      for (const event of events) {
        handleCallMemberEvent(event, store);
      }
    }
  }
  console.log(`[Matrix] Scanned ${rooms.length} rooms for call state.`);
}

module.exports = { createMatrixClient };

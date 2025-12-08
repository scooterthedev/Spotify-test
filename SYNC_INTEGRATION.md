# Integration Guide: Cross-Device Sync Refactor

## What Changed

The auto-sync feature has been completely refactored to work **without Spotify Premium** by using a position-sharing system instead of Spotify Connect.

### Before (Premium Only)
- ❌ Spotify Connect required Premium
- ❌ Limited to official Spotify clients
- ❌ Complex playback control logic

### After (Free for Everyone)
- ✅ Works on any Spotify tier (Free/Premium)
- ✅ Works with web player + any secondary devices
- ✅ Simple position-sharing API
- ✅ Real-time sync across devices
- ✅ YouTube playback support for secondary devices

---

## File Structure

```
MyWebsite/
├── app/
│   └── api/
│       └── sync/
│           └── session/
│               └── route.js          [NEW] Session management API
├── components/
│   ├── spotify.jsx                   [MODIFIED] Added sync panel
│   └── sync-player.jsx               [NEW] Sync UI component
└── SYNC_FEATURE.md                   [NEW] Full documentation
```

---

## Quick Start

### 1. The Sync API (`/api/sync/session`)

Handles 4 actions:

```javascript
// Create a new sync session
POST /api/sync/session
{
  "action": "create"
}
// Returns: { sessionId: "...", code: "AB1C2D" }

// Join an existing session
POST /api/sync/session
{
  "action": "join",
  "sessionId": "abc123...",
  "deviceId": "device_xyz",
  "deviceName": "My iPhone",
  "progressMs": 15000
}
// Returns: { success: true, session: {...} }

// Update playback position (host only)
POST /api/sync/session
{
  "action": "update",
  "sessionId": "abc123...",
  "deviceId": "device_xyz",
  "progressMs": 45000
}
// Returns: { success: true }

// Get current session state
POST /api/sync/session
{
  "action": "get",
  "sessionId": "abc123..."
}
// Returns: { id, currentProgressMs, isPlaying, devices: [...] }
```

### 2. The Sync Player Component

```jsx
import SyncPlayer from '@/components/sync-player';

// In parent component
const [syncProgressMs, setSyncProgressMs] = useState(null);

<SyncPlayer 
  songData={currentSong}
  onSyncProgress={setSyncProgressMs}
/>
```

**Props:**
- `songData`: Current song data (title, progressMs, etc.)
- `onSyncProgress`: Callback when synced progress updates `(progressMs) => void`

### 3. Updated Spotify Component

The Spotify component now:
1. Displays a "Sync Across Devices" button
2. Manages sync panel visibility
3. Receives synced progress via `setSyncProgressMs`
4. Uses synced progress for YouTube player sync

**State:**
```javascript
const [showSyncPanel, setShowSyncPanel] = useState(false);
const [syncProgressMs, setSyncProgressMs] = useState(null);
```

**Progress priority:**
```javascript
const currentProgress = syncProgressMs !== null 
  ? syncProgressMs 
  : localSongData?.progressMs
```

---

## User Flow

### Host Device (Music Player)
1. User opens app and plays a song on Spotify
2. Clicks "Sync Across Devices" button
3. Clicks "Create Sync Session"
4. Gets 6-digit code (e.g., `AB1C2D`)
5. Shares code with other users
6. Host device sends `progressMs` every 500ms to API

### Secondary Device (Follower)
1. User opens app
2. Clicks "Sync Across Devices" button
3. Enters 6-digit code
4. Clicks "Join"
5. Device joins session and shows:
   - "Connected" status indicator
   - List of connected devices
   - Live progress from host
6. Receives progress updates every 1 second
7. YouTube player auto-syncs if video found

---

## Data Flow Diagram

```
┌─────────────────────────────────────────┐
│         HOST DEVICE                     │
│    Playing Spotify Music                │
├─────────────────────────────────────────┤
│ spotify.jsx                             │
│ └─ SyncPlayer                           │
│    └─ "Create Sync Session" → API      │
│       Returns: code = "AB1C2D"         │
│                                         │
│ Every 500ms:                            │
│ progressMs = 45000                      │
│ POST /api/sync/session (update)         │
└────────────────┬──────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │   API Server   │
        │ sync/session   │
        └────────────────┘
                 ▲
    ┌────────────┼────────────┐
    │            │            │
    ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│DEVICE 2 │ │DEVICE 3 │ │DEVICE N │
│ Joined: │ │ Joined: │ │ Joined: │
│ AB1C2D  │ │ AB1C2D  │ │ AB1C2D  │
├─────────┤ ├─────────┤ ├─────────┤
│Polling  │ │Polling  │ │Polling  │
│every 1s │ │every 1s │ │every 1s │
│         │ │         │ │         │
│Progress:│ │Progress:│ │Progress:│
│45000ms  │ │45000ms  │ │45000ms  │
└─────────┘ └─────────┘ └─────────┘
```

---

## Code Example: Using Synced Progress

In `spotify.jsx`:

```javascript
// Receive synced progress from SyncPlayer
const handleSyncProgress = (progressMs) => {
  setSyncProgressMs(progressMs);
};

// Use it for interpolation
useEffect(() => {
  setInterval(() => {
    setLocalSongData(d => {
      // Use synced progress if available
      const elapsed = syncProgressMs !== null 
        ? syncProgressMs 
        : baseProgressRef.current + (performance.now() - perfStartRef.current);
      
      return { ...d, progressMs: elapsed };
    });
  }, 100);
}, [syncProgressMs]);

// Use it for YouTube sync
useEffect(() => {
  const targetTime = (syncProgressMs !== null 
    ? syncProgressMs 
    : localSongData?.progressMs) / 1000;
  
  if (drift > 3) {
    playerRef.current.seekTo(targetTime, 'seconds');
  }
}, [syncProgressMs, localSongData?.progressMs]);
```

---

## Testing Checklist

- [ ] Host device can create a sync session
- [ ] 6-digit code is displayed and shareable
- [ ] Secondary device can join with the code
- [ ] "Connected" status appears on both devices
- [ ] Devices list updates in real-time
- [ ] Playing music on host updates secondary device progress
- [ ] Progress updates are smooth (no big jumps)
- [ ] Pausing on host stops updates on secondary
- [ ] Resuming on host resumes on secondary
- [ ] YouTube player syncs to synced progress
- [ ] Can end session and rejoin with same code

---

## Production Deployment Notes

### Session Storage (Currently In-Memory)
Replace with database:

```javascript
// Current: Map in memory
const syncSessions = new Map();

// TODO: Replace with Redis
const redis = new Redis();
await redis.setex(`sync:${sessionId}`, 1800, JSON.stringify(session));
```

### Performance Considerations
- **1s polling interval**: Low bandwidth, slight latency
- **For real-time**: Switch to WebSocket
- **Session cleanup**: Add 30min TTL for inactive sessions
- **Concurrent users**: In-memory Map has no limit (add cleanup)

### Security
- Add optional session passwords
- Rate limit session creation (max 10/min per IP)
- Validate deviceId format
- Add CORS restrictions if needed

### Future Optimizations
1. **WebSocket Sync**: Replace polling with bidirectional streams
2. **Audio Playback**: Enable secondary devices to play audio
3. **Offline Support**: Cache sessions with Service Workers
4. **Analytics**: Track sync sessions, devices, duration
5. **Retry Logic**: Handle network failures gracefully

---

## Troubleshooting

### Secondary device not updating
- Check if host is playing (green dot on host)
- Verify same 6-digit code
- Check browser console for errors
- Refresh page if stuck

### Drift on YouTube player
- Occurs when YouTube video duration differs from Spotify
- Auto-corrects every 3 seconds (intentional)
- Can happen with music videos vs official versions

### Session code not working
- Code expires after ~30 minutes (in production)
- Host must still have session open
- Refresh and create new session if needed

---

## Next Steps

1. **Test locally** using the testing guide in SYNC_FEATURE.md
2. **Deploy to production** with Redis session storage
3. **Monitor** session creation/join rates
4. **Gather feedback** from users
5. **Implement WebSocket** if polling latency is an issue
6. **Add audio playback** if secondary device audio is needed

---

## Summary

The refactored sync feature provides:
- ✅ Free syncing (no Premium required)
- ✅ Multi-device support
- ✅ Real-time position updates
- ✅ YouTube video integration
- ✅ Clean, maintainable API
- ✅ Easy to extend/improve

Total implementation: **3 files, ~500 lines of code**

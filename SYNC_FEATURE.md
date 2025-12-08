# Cross-Device Sync Feature (Free, No Premium Required)

## Overview
This refactored auto-sync feature allows you to sync Spotify playback position across multiple devices **without requiring Spotify Premium**. One device acts as the host (plays the music), and other devices follow the playback position in real-time.

## How It Works

### Architecture
1. **Host Device**: The primary device playing music through Spotify (your phone, computer, etc.)
2. **Synced Devices**: Secondary devices that follow the playback position using a local sync session
3. **Sync Session**: A temporary session managed via API that tracks playback position and connected devices

### Key Components

#### API Route: `/api/sync/session`
Handles all sync session management:
- **create**: Generates a new sync session with a 6-digit code
- **join**: Adds a device to an existing session
- **update**: Updates current playback position (host only)
- **get**: Retrieves current session state and connected devices

#### React Component: `SyncPlayer` (`components/sync-player.jsx`)
- Creates/joins sync sessions
- Displays 6-digit share code for easy joining
- Shows connected devices in real-time
- Polls for playback updates (1-second intervals)
- Non-host devices follow the host's progress

#### Spotify Component: `components/spotify.jsx`
- Integrated sync panel with toggle button
- Receives sync progress updates from `SyncPlayer`
- Updates YouTube player (if used) to match synced position
- Falls back to local playback when not synced

## Usage

### For the Host Device (Music Player)
1. Click "Sync Across Devices" button
2. Click "Create Sync Session"
3. A 6-digit code appears (e.g., `AB1C2D`)
4. Share this code with other devices
5. Your playback position is sent to all connected devices every 500ms

### For Secondary Devices
1. Click "Sync Across Devices" button
2. Click "Join with Code"
3. Enter the 6-digit code from the host
4. Click "Join"
5. Your device now follows the host's playback position
6. Progress updates received every 1 second

## Technical Details

### Syncing Mechanism
- **Host updates**: Every 500ms, sends current `progressMs` to the API
- **Client polling**: Every 1 second, non-host devices poll for the latest position
- **Player sync**: YouTube player (if enabled) corrects drift > 3 seconds every 3 seconds
- **Local interpolation**: Progress ticks every 100ms between API updates for smooth playback

### Data Flow
```
Host Device (Spotify Playing)
    ↓
    sends progressMs every 500ms
    ↓
/api/sync/session (update action)
    ↓
In-memory session store
    ↓
Client Device 1 (polling every 1s)
Client Device 2 (polling every 1s)
Client Device N (polling every 1s)
```

### Session Storage
Currently uses in-memory storage (Map). For production, replace with:
- Redis (for persistence across server restarts)
- MongoDB/PostgreSQL (for analytics)
- Add TTL: sessions auto-expire after 30 minutes of inactivity

## Device Requirements
- Works on any device with a web browser
- No Spotify Premium required
- Works with free tier Spotify or any music service you play locally
- YouTube videos sync automatically when available

## Features

✅ **Free - No Premium Required**
- Unlike Spotify Connect which requires Premium
- Works with any Spotify account tier

✅ **Dual Playback Options**
- Primary: Play music on your main device (phone, desktop)
- Secondary: Sync YouTube videos on other devices (for audio/video or lyrics)

✅ **Real-time Sync**
- 1-second polling interval for tight sync
- Automatic drift correction for YouTube player
- Handles pause/resume correctly

✅ **Multi-Device Support**
- Host: 1 device
- Secondary devices: Unlimited
- Easy 6-digit code for joining

✅ **No Authentication Needed**
- Sessions are temporary and anonymous
- No login required on secondary devices

## Limitations

- **Sessions are temporary**: Refreshing the page loses the session
- **In-memory storage**: Sessions don't persist across server restarts (use Redis in production)
- **One host at a time**: Only the host's position is synced
- **Network dependent**: Requires stable internet for polling
- **No audio sync**: Secondary devices don't play audio (just follow position for YouTube/lyrics)

## Future Enhancements

1. **WebSocket Support**: Replace polling with WebSocket for lower latency
2. **Database Persistence**: Store sessions in Redis/MongoDB
3. **Multiple Hosts**: Support switching host device mid-session
4. **Audio Playback**: Enable secondary devices to play audio via WebAudio API
5. **Sync Quality Metrics**: Show latency and connection quality
6. **Session Passwords**: Protect sessions with optional passwords
7. **Mobile Optimizations**: PWA support for easier joining on phones

## Code Changes Summary

### New Files
- `/app/api/sync/session/route.js` - Session management API
- `/components/sync-player.jsx` - Sync UI component

### Modified Files
- `/components/spotify.jsx` - Integrated sync panel and progress updates

### Key Changes to Spotify Component
1. Added `syncProgressMs` state for receiving synced progress
2. Added sync panel toggle button
3. Updated progress calculation to use synced position
4. YouTube player now syncs to synced progress instead of just local progress
5. Removed YouTube-only requirement (can work standalone)

## Testing

### Local Testing
```bash
# Terminal 1: Host device
npm run dev
# Visit localhost:3000, click "Create Sync Session"

# Terminal 2: Secondary device (different port)
npm run dev -- -p 3001
# Visit localhost:3001, click "Join with Code"
# Enter the 6-digit code
```

### Manual Testing Checklist
- [ ] Create session on Device A
- [ ] Join session on Device B with code
- [ ] Verify Device B shows "Connected" status
- [ ] Play music on Device A
- [ ] Verify Device B updates position every 1s
- [ ] Pause on Device A
- [ ] Verify Device B stops updating
- [ ] End session, verify cleanup

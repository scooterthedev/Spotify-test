# Database Logging Implementation

## What Changed

Migrated from file-based logging (`data/listening-history.json`) to Neon PostgreSQL database. This allows logging to persist on Vercel and work even when the website is closed.

## How It Works

### Backend Components

1. **Database Tables** (added to `lib/db.js`):
   - `listening_history`: Raw log of every listening session (title, artist, progress, timestamp)
   - `song_stats`: Aggregated stats per song (play count, total listening time, first/last played)

2. **Database Functions** (in `lib/db.js`):
   - `logListeningSession()`: Logs raw listening data
   - `updateSongStats()`: Updates aggregated song statistics
   - `getListeningStats()`: Retrieves top songs
   - `getTotalListeningTime()`: Gets total listening time
   - `getRecentListeningHistory()`: Gets recent listening sessions

3. **API Endpoint** (`app/api/spotify/log/route.js`):
   - **POST**: Accepts listening data, logs to DB, updates song stats
   - **GET**: Returns listening statistics (summary, top songs, recent sessions)

### Frontend Changes

**File**: `app/page.js`
- Added `lastProgressMs` state to track progress between polls
- Updated logging request to include `lastProgressMs` for accurate listening time calculation
- Removed `timestamp` field (now handled server-side)

## Current Behavior

1. Every 5 seconds, the app calls `/api/spotify/log` with current song data
2. Backend stores raw data in `listening_history` table
3. Backend updates aggregated stats in `song_stats` table
4. Stats refresh on page load and every 60 seconds
5. Logs persist across:
   - Website closes/reopens ✓
   - Server restarts ✓
   - Multiple devices ✓ (all data flows to same Neon DB)

## No Webhook Needed

Spotify webhooks aren't necessary because:
- You're already polling `/api/spotify/me` every 5 seconds
- The polling approach is lightweight and works reliably
- Backend logs persist regardless of website state

## Deployment Steps

1. Ensure `DATABASE_URL` environment variable points to your Neon database
2. Deploy the changes - tables will be created automatically on first request
3. Old `data/listening-history.json` file is no longer used (can be deleted)

## Database Schema

```sql
-- Listening history (raw logs)
CREATE TABLE listening_history (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  uri TEXT,
  progress_ms INTEGER,
  duration_ms INTEGER,
  playing BOOLEAN,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at BIGINT
);

-- Song statistics (aggregated)
CREATE TABLE song_stats (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  uri TEXT,
  first_played TIMESTAMP,
  last_played TIMESTAMP,
  play_count INTEGER DEFAULT 0,
  total_listening_time_ms INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_listening_history_timestamp ON listening_history(timestamp);
CREATE INDEX idx_song_stats_artist_title ON song_stats(artist, title);
```

## Benefits

✓ **Persistent logging**: Works on Vercel production  
✓ **Survives website close**: Logging happens server-side  
✓ **Multi-device sync**: All devices write to same database  
✓ **No external webhooks**: Polling approach is reliable  
✓ **Accurate metrics**: Tracks listening time, play count, first/last played  
✓ **Query-friendly**: Aggregated stats available immediately  

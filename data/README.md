# Listening History Data

This directory contains your Spotify listening history and analytics data.

## Files

- `listening-history.json` - Complete listening history with song stats and session logs

## Data Structure

```json
{
  "totalListeningTimeMs": 0,          // Total time spent listening across all songs
  "lastUpdated": "ISO-8601 timestamp",
  "sessions": [                        // Global session log (last 10,000)
    {
      "timestamp": "ISO-8601",
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "progressMs": 45000,
      "durationMs": 180000,
      "playing": true,
      "uri": "spotify:track:..."
    }
  ],
  "songs": {                           // Per-song statistics
    "Song Title|||Artist Name": {
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "uri": "spotify:track:...",
      "firstPlayed": "ISO-8601",
      "lastPlayed": "ISO-8601",
      "playCount": 5,
      "totalListeningTimeMs": 900000,
      "sessions": [...]                // Last 100 sessions for this song
    }
  }
}
```

## API Endpoints

### POST `/api/spotify/log`
Log a listening session (called automatically every 5 seconds while playing)

### GET `/api/spotify/log`
Retrieve listening statistics:
- Total listening time (hours)
- Total unique songs
- Top 50 songs by play count
- Recent 20 sessions

## Analytics

You can use this data to generate:
- Monthly/yearly listening reports
- Top songs charts
- Listening time trends
- Artist statistics
- Album analytics

Example queries using the JSON data:
```javascript
// Get songs played in a specific month
const monthSongs = Object.values(data.songs).filter(song => 
  new Date(song.lastPlayed).getMonth() === targetMonth
);

// Calculate total hours in a date range
const rangeListening = data.sessions
  .filter(s => new Date(s.timestamp) >= startDate && new Date(s.timestamp) <= endDate)
  .reduce((acc, s, i, arr) => {
    if (i > 0 && s.playing && arr[i-1].playing) {
      return acc + Math.min(s.progressMs - arr[i-1].progressMs, 10000);
    }
    return acc;
  }, 0);
```

## Backup

Regularly backup this file to preserve your listening history!

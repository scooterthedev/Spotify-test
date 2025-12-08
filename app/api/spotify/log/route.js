import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'data', 'listening-history.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dir = path.dirname(LOG_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Load existing log data
async function loadLog() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(LOG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      totalListeningTimeMs: 0,
      sessions: [],
      songs: {},
      lastUpdated: null
    };
  }
}

// Save log data
async function saveLog(data) {
  await ensureDataDir();
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, artist, album, progressMs, durationMs, playing, timestamp, uri } = body;

    if (!title || !artist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const log = await loadLog();
    const now = timestamp || new Date().toISOString();
    const songKey = `${title}|||${artist}`;

    // Initialize song entry if it doesn't exist
    if (!log.songs[songKey]) {
      log.songs[songKey] = {
        title,
        artist,
        album: album || null,
        uri: uri || null,
        firstPlayed: now,
        lastPlayed: now,
        playCount: 0,
        totalListeningTimeMs: 0,
        sessions: []
      };
    }

    const song = log.songs[songKey];
    song.lastPlayed = now;
    song.album = album || song.album;
    song.uri = uri || song.uri;

    // Add session entry
    const sessionEntry = {
      timestamp: now,
      progressMs: progressMs || 0,
      durationMs: durationMs || 0,
      playing
    };

    song.sessions.push(sessionEntry);

    // Update play count if song just started or changed
    const recentSessions = song.sessions.slice(-2);
    if (recentSessions.length === 1 || 
        (recentSessions.length === 2 && 
         Math.abs(recentSessions[1].progressMs - recentSessions[0].progressMs) > 10000)) {
      song.playCount++;
    }

    // Calculate listening time increment (based on time between polls)
    if (playing && progressMs > 0) {
      const lastSession = song.sessions[song.sessions.length - 2];
      if (lastSession && lastSession.playing) {
        const timeDiff = Math.min(progressMs - lastSession.progressMs, 10000); // Cap at 10s to handle skips
        if (timeDiff > 0 && timeDiff <= 10000) {
          song.totalListeningTimeMs += timeDiff;
          log.totalListeningTimeMs += timeDiff;
        }
      }
    }

    // Add to global sessions log
    log.sessions.push({
      timestamp: now,
      title,
      artist,
      album,
      progressMs,
      durationMs,
      playing,
      uri
    });

    // Keep only last 10000 global sessions to prevent file bloat
    if (log.sessions.length > 10000) {
      log.sessions = log.sessions.slice(-10000);
    }

    // Keep only last 100 sessions per song
    if (song.sessions.length > 100) {
      song.sessions = song.sessions.slice(-100);
    }

    await saveLog(log);

    return NextResponse.json({ 
      success: true,
      totalListeningTimeMs: log.totalListeningTimeMs,
      songPlayCount: song.playCount,
      songListeningTimeMs: song.totalListeningTimeMs
    });

  } catch (error) {
    console.error('Error logging listening data:', error);
    return NextResponse.json({ error: 'Failed to log data' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const log = await loadLog();
    
    // Calculate stats
    const totalSongs = Object.keys(log.songs).length;
    const totalHours = (log.totalListeningTimeMs / (1000 * 60 * 60)).toFixed(2);
    
    // Get top songs
    const topSongs = Object.values(log.songs)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 50)
      .map(song => ({
        title: song.title,
        artist: song.artist,
        playCount: song.playCount,
        totalListeningTimeMs: song.totalListeningTimeMs,
        firstPlayed: song.firstPlayed,
        lastPlayed: song.lastPlayed
      }));

    return NextResponse.json({
      summary: {
        totalListeningTimeMs: log.totalListeningTimeMs,
        totalListeningHours: parseFloat(totalHours),
        totalSongs,
        totalSessions: log.sessions.length,
        lastUpdated: log.lastUpdated
      },
      topSongs,
      recentSessions: log.sessions.slice(-20)
    });

  } catch (error) {
    console.error('Error getting log data:', error);
    return NextResponse.json({ error: 'Failed to get log data' }, { status: 500 });
  }
}

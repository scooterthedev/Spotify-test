import { Pool } from 'pg';
import { randomBytes } from 'crypto';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let tablesInitialized = false;

// Initialize tables once
async function initializeTables() {
  if (tablesInitialized) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        current_progress_ms INTEGER DEFAULT 0,
        is_playing BOOLEAN DEFAULT false
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        joined_at BIGINT NOT NULL,
        progress_ms INTEGER DEFAULT 0,
        last_updated BIGINT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS listening_history (
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
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS song_stats (
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
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listening_history_timestamp ON listening_history(timestamp);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_song_stats_artist_title ON song_stats(artist, title);
    `);

    tablesInitialized = true;
  } catch (error) {
    console.error('Failed to initialize tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function createSession() {
  await initializeTables();

  const sessionId = randomBytes(16).toString('hex');
  const code = randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
  const now = Date.now();
  const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    `INSERT INTO sessions (id, code, created_at, expires_at, current_progress_ms, is_playing)
     VALUES ($1, $2, $3, $4, 0, false);`,
    [sessionId, code, now, expiresAt]
  );

  return { sessionId, code };
}

export async function getSessionByCode(code) {
  const result = await pool.query(
    `SELECT * FROM sessions WHERE code = $1 AND expires_at > $2;`,
    [code, Date.now()]
  );

  return result.rows[0] || null;
}

export async function getSessionById(sessionId) {
  const result = await pool.query(
    `SELECT * FROM sessions WHERE id = $1 AND expires_at > $2;`,
    [sessionId, Date.now()]
  );

  return result.rows[0] || null;
}

export async function addDevice(sessionId, deviceId, deviceName, progressMs = 0) {
  const now = Date.now();

  await pool.query(
    `INSERT INTO devices (id, session_id, name, joined_at, progress_ms, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(id) DO UPDATE SET
       progress_ms = $5,
       last_updated = $6;`,
    [deviceId, sessionId, deviceName, now, progressMs, now]
  );
}

export async function getDevices(sessionId) {
  const result = await pool.query(
    `SELECT id, name, joined_at, progress_ms FROM devices WHERE session_id = $1;`,
    [sessionId]
  );

  return result.rows;
}

export async function updateSessionProgress(sessionId, deviceId, progressMs) {
  const now = Date.now();

  // Update session
  await pool.query(
    `UPDATE sessions SET current_progress_ms = $1 WHERE id = $2;`,
    [progressMs, sessionId]
  );

  // Update device
  await pool.query(
    `UPDATE devices SET progress_ms = $1, last_updated = $2
     WHERE id = $3 AND session_id = $4;`,
    [progressMs, now, deviceId, sessionId]
  );
}

// Logging functions
export async function logListeningSession(title, artist, album, uri, progressMs, durationMs, playing) {
  await initializeTables();
  
  const now = Date.now();
  await pool.query(
    `INSERT INTO listening_history (title, artist, album, uri, progress_ms, duration_ms, playing, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [title, artist, album, uri, progressMs, durationMs, playing, now]
  );
}

export async function updateSongStats(title, artist, album, uri, playing, progressMs, lastProgressMs) {
  await initializeTables();
  
  const now = new Date();
  const songKey = `${title}|||${artist}`;
  
  // Upsert song stats
  await pool.query(
    `INSERT INTO song_stats (title, artist, album, uri, first_played, last_played, play_count, total_listening_time_ms)
     VALUES ($1, $2, $3, $4, $5, $6, 1, 0)
     ON CONFLICT(artist, title) DO UPDATE SET
       album = COALESCE($3, song_stats.album),
       uri = COALESCE($4, song_stats.uri),
       last_played = $6,
       updated_at = NOW()
     WHERE song_stats.title = $1 AND song_stats.artist = $2;`,
    [title, artist, album, uri, now, now]
  );
  
  // Update listening time if song is playing
  if (playing && progressMs > 0 && lastProgressMs !== null) {
    const timeDiff = Math.min(progressMs - lastProgressMs, 10000);
    if (timeDiff > 0 && timeDiff <= 10000) {
      await pool.query(
        `UPDATE song_stats 
         SET total_listening_time_ms = total_listening_time_ms + $1
         WHERE title = $2 AND artist = $3;`,
        [timeDiff, title, artist]
      );
    }
  }
}

export async function getListeningStats(limit = 50) {
  const result = await pool.query(
    `SELECT title, artist, album, play_count, total_listening_time_ms, first_played, last_played
     FROM song_stats
     ORDER BY play_count DESC
     LIMIT $1;`,
    [limit]
  );
  
  return result.rows;
}

export async function getTotalListeningTime() {
  const result = await pool.query(
    `SELECT COALESCE(SUM(total_listening_time_ms), 0) as total FROM song_stats;`
  );
  
  return result.rows[0].total || 0;
}

export async function getRecentListeningHistory(limit = 20) {
  const result = await pool.query(
    `SELECT title, artist, album, progress_ms, duration_ms, playing, timestamp
     FROM listening_history
     ORDER BY timestamp DESC
     LIMIT $1;`,
    [limit]
  );
  
  return result.rows;
}

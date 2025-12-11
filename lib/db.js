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
      CREATE TABLE IF NOT EXISTS song_plays (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        uri TEXT,
        duration_ms INTEGER,
        listening_time_ms INTEGER DEFAULT 0,
        first_played TIMESTAMP DEFAULT NOW(),
        last_played TIMESTAMP DEFAULT NOW(),
        times_listened INTEGER DEFAULT 1,
        total_listening_time_ms INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(title, artist)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_song_plays_artist_title ON song_plays(artist, title);
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

// Logging functions - only called when song completes or changes
export async function logSongPlay(title, artist, album, uri, durationMs, listeningTimeMs) {
  await initializeTables();
  
  const now = new Date();
  
  // Upsert song play record (one per song)
  await pool.query(
    `INSERT INTO song_plays (title, artist, album, uri, duration_ms, listening_time_ms, times_listened, total_listening_time_ms, first_played, last_played, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, $6, $7, $7, $7)
     ON CONFLICT(title, artist) DO UPDATE SET
       album = COALESCE($3, song_plays.album),
       uri = COALESCE($4, song_plays.uri),
       duration_ms = COALESCE($5, song_plays.duration_ms),
       listening_time_ms = $6,
       times_listened = song_plays.times_listened + 1,
       total_listening_time_ms = song_plays.total_listening_time_ms + $6,
       last_played = $7,
       updated_at = $7;`,
    [title, artist, album, uri, durationMs, listeningTimeMs, now]
  );
}

export async function getListeningStats(limit = 50) {
  const result = await pool.query(
    `SELECT title, artist, album, times_listened, total_listening_time_ms, first_played, last_played, listening_time_ms
     FROM song_plays
     ORDER BY times_listened DESC
     LIMIT $1;`,
    [limit]
  );
  
  return result.rows;
}

export async function getTotalListeningTime() {
  const result = await pool.query(
    `SELECT COALESCE(SUM(total_listening_time_ms), 0) as total FROM song_plays;`
  );
  
  return result.rows[0].total || 0;
}

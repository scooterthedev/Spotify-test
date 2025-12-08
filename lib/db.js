import Database from 'better-sqlite3';
import path from 'path';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';

let db = null;

function getDb() {
  if (!db) {
    const dataDir = path.join(process.cwd(), 'data');
    mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'sync-sessions.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const db = getDb();
  
  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      current_progress_ms INTEGER DEFAULT 0,
      is_playing INTEGER DEFAULT 0
    )
  `);

  // Create devices table
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      joined_at INTEGER NOT NULL,
      progress_ms INTEGER DEFAULT 0,
      last_updated INTEGER,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Create index for code lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code)
  `);
}

export function createSession() {
  const db = getDb();
  
  const sessionId = randomBytes(16).toString('hex');
  const code = randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
  const now = Date.now();
  const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours
  
  const stmt = db.prepare(`
    INSERT INTO sessions (id, code, created_at, expires_at, current_progress_ms, is_playing)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(sessionId, code, now, expiresAt, 0, 0);
  
  return { sessionId, code };
}

export function getSessionByCode(code) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM sessions WHERE code = ? AND expires_at > ?
  `);
  
  const session = stmt.get(code, Date.now());
  return session;
}

export function getSessionById(sessionId) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM sessions WHERE id = ? AND expires_at > ?
  `);
  
  return stmt.get(sessionId, Date.now());
}

export function addDevice(sessionId, deviceId, deviceName, progressMs = 0) {
  const db = getDb();
  const now = Date.now();
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO devices (id, session_id, name, joined_at, progress_ms, last_updated)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(deviceId, sessionId, deviceName, now, progressMs, now);
}

export function getDevices(sessionId) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, name, joined_at, progress_ms FROM devices WHERE session_id = ?
  `);
  
  return stmt.all(sessionId);
}

export function updateSessionProgress(sessionId, deviceId, progressMs) {
  const db = getDb();
  const now = Date.now();
  
  // Update session
  const sessionStmt = db.prepare(`
    UPDATE sessions SET current_progress_ms = ? WHERE id = ?
  `);
  sessionStmt.run(progressMs, sessionId);
  
  // Update device
  const deviceStmt = db.prepare(`
    UPDATE devices SET progress_ms = ?, last_updated = ? WHERE id = ? AND session_id = ?
  `);
  deviceStmt.run(progressMs, now, deviceId, sessionId);
}

export function cleanup() {
  const db = getDb();
  // Delete expired sessions
  db.prepare(`
    DELETE FROM sessions WHERE expires_at < ?
  `).run(Date.now());
}

// Cleanup expired sessions every hour
setInterval(cleanup, 60 * 60 * 1000);

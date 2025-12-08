import { getEdgeConfig } from '@vercel/edge-config';
import { randomBytes } from 'crypto';

async function getConfig() {
  try {
    return await getEdgeConfig();
  } catch (error) {
    console.error('Failed to get edge config:', error);
    throw error;
  }
}

export async function createSession() {
  const config = await getConfig();
  const sessionId = randomBytes(16).toString('hex');
  const code = randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
  const now = Date.now();
  const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours

  const sessionData = {
    id: sessionId,
    code: code,
    createdAt: now,
    expiresAt: expiresAt,
    currentProgressMs: 0,
    isPlaying: false,
  };

  // Get current sessions
  const sessions = await config.get('sessions') || {};
  const codes = await config.get('codes') || {};

  // Store session and code mapping
  sessions[sessionId] = sessionData;
  codes[code] = sessionId;

  // Update config
  await config.set({ sessions, codes });

  return { sessionId, code };
}

export async function getSessionByCode(code) {
  const config = await getConfig();
  const codes = await config.get('codes') || {};
  const sessionId = codes[code];

  if (!sessionId) return null;

  const sessions = await config.get('sessions') || {};
  const session = sessions[sessionId];

  // Check if expired
  if (session && session.expiresAt > Date.now()) {
    return session;
  }

  return null;
}

export async function getSessionById(sessionId) {
  const config = await getConfig();
  const sessions = await config.get('sessions') || {};
  const session = sessions[sessionId];

  // Check if expired
  if (session && session.expiresAt > Date.now()) {
    return session;
  }

  return null;
}

export async function addDevice(sessionId, deviceId, deviceName, progressMs = 0) {
  const config = await getConfig();
  const deviceData = {
    id: deviceId,
    name: deviceName,
    joinedAt: Date.now(),
    progressMs: progressMs,
    lastUpdated: Date.now(),
  };

  // Get current devices
  const allDevices = await config.get('devices') || {};
  if (!allDevices[sessionId]) {
    allDevices[sessionId] = {};
  }

  allDevices[sessionId][deviceId] = deviceData;

  // Update config
  await config.set({ devices: allDevices });
}

export async function getDevices(sessionId) {
  const config = await getConfig();
  const allDevices = await config.get('devices') || {};

  if (!allDevices[sessionId]) {
    return [];
  }

  return Object.values(allDevices[sessionId]);
}

export async function updateSessionProgress(sessionId, deviceId, progressMs) {
  const config = await getConfig();

  // Update session progress
  const sessions = await config.get('sessions') || {};
  if (sessions[sessionId]) {
    sessions[sessionId].currentProgressMs = progressMs;
  }

  // Update device progress
  const allDevices = await config.get('devices') || {};
  if (allDevices[sessionId] && allDevices[sessionId][deviceId]) {
    allDevices[sessionId][deviceId].progressMs = progressMs;
    allDevices[sessionId][deviceId].lastUpdated = Date.now();
  }

  // Update config
  await config.set({ sessions, devices: allDevices });
}

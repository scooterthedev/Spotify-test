import { randomBytes } from 'crypto';

// In-memory store (replace with database in production)
const syncSessions = new Map();
const codeToSessionId = new Map(); // Map codes to full session IDs

export async function POST(req) {
  try {
    const { action, sessionId, deviceId, deviceName, progressMs } = await req.json();

    if (action === 'create') {
      const newSessionId = randomBytes(16).toString('hex');
      const code = randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
      
      syncSessions.set(newSessionId, {
        id: newSessionId,
        code: code,
        createdAt: Date.now(),
        devices: new Map(),
        currentProgressMs: 0,
        isPlaying: false,
      });
      codeToSessionId.set(code, newSessionId);
      
      return Response.json({ 
        sessionId: newSessionId,
        code: code
      });
    }

    if (action === 'join') {
      // Support both full sessionId and code
      let actualSessionId = sessionId;
      if (sessionId && sessionId.length === 6) {
        // Looks like a code, resolve it
        actualSessionId = codeToSessionId.get(sessionId);
        if (!actualSessionId) {
          return Response.json({ error: 'Invalid session code' }, { status: 404 });
        }
      }
      
      const session = syncSessions.get(actualSessionId);
      if (!session) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      session.devices.set(deviceId, {
        id: deviceId,
        name: deviceName,
        joinedAt: Date.now(),
        progressMs: progressMs || 0,
      });

      return Response.json({
        success: true,
        session: {
          id: session.id,
          code: session.code,
          currentProgressMs: session.currentProgressMs,
          isPlaying: session.isPlaying,
          devices: Array.from(session.devices.values())
        }
      });
    }

    if (action === 'update') {
      // Support both full sessionId and code
      let actualSessionId = sessionId;
      if (sessionId && sessionId.length === 6) {
        actualSessionId = codeToSessionId.get(sessionId);
        if (!actualSessionId) {
          return Response.json({ error: 'Invalid session code' }, { status: 404 });
        }
      }
      
      const session = syncSessions.get(actualSessionId);
      if (!session) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      const device = session.devices.get(deviceId);
      if (!device) {
        return Response.json({ error: 'Device not in session' }, { status: 404 });
      }

      session.currentProgressMs = progressMs;
      device.progressMs = progressMs;
      device.lastUpdated = Date.now();

      return Response.json({ success: true });
    }

    if (action === 'get') {
      // Support both full sessionId and code
      let actualSessionId = sessionId;
      if (sessionId && sessionId.length === 6) {
        actualSessionId = codeToSessionId.get(sessionId);
        if (!actualSessionId) {
          return Response.json({ error: 'Invalid session code' }, { status: 404 });
        }
      }
      
      const session = syncSessions.get(actualSessionId);
      if (!session) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      return Response.json({
        id: session.id,
        currentProgressMs: session.currentProgressMs,
        isPlaying: session.isPlaying,
        devices: Array.from(session.devices.values()).map(d => ({
          id: d.id,
          name: d.name,
          progressMs: d.progressMs,
        }))
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Sync session error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

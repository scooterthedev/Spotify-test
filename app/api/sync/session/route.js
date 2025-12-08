import { randomBytes } from 'crypto';

// In-memory store (replace with database in production)
const syncSessions = new Map();

export async function POST(req) {
  try {
    const { action, sessionId, deviceId, deviceName, progressMs } = await req.json();

    if (action === 'create') {
      const newSessionId = randomBytes(16).toString('hex');
      syncSessions.set(newSessionId, {
        id: newSessionId,
        createdAt: Date.now(),
        devices: new Map(),
        currentProgressMs: 0,
        isPlaying: false,
      });
      
      return Response.json({ 
        sessionId: newSessionId,
        code: newSessionId.slice(0, 6).toUpperCase()
      });
    }

    if (action === 'join') {
      const session = syncSessions.get(sessionId);
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
          currentProgressMs: session.currentProgressMs,
          isPlaying: session.isPlaying,
          devices: Array.from(session.devices.values())
        }
      });
    }

    if (action === 'update') {
      const session = syncSessions.get(sessionId);
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
      const session = syncSessions.get(sessionId);
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

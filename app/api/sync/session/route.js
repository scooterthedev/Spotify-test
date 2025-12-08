import { 
  createSession, 
  getSessionByCode, 
  getSessionById, 
  addDevice, 
  getDevices, 
  updateSessionProgress 
} from '@/lib/db';

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, sessionId, deviceId, deviceName, progressMs } = body;
    
    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    if (action === 'create') {
      const { sessionId: newSessionId, code } = await createSession();
      
      return Response.json({ 
        sessionId: newSessionId,
        code: code
      });
    }

    if (action === 'join') {
      // Support both full sessionId and code
      let actualSessionId = sessionId;
      let session = null;

      if (sessionId && sessionId.length === 6) {
        // Looks like a code, resolve it
        session = await getSessionByCode(sessionId);
        if (!session) {
          return Response.json({ error: 'Invalid session code' }, { status: 404 });
        }
        actualSessionId = session.id;
      } else {
        session = await getSessionById(sessionId);
        if (!session) {
          return Response.json({ error: 'Session not found' }, { status: 404 });
        }
      }

      // Add device to session
      await addDevice(actualSessionId, deviceId, deviceName, progressMs || 0);

      const devices = await getDevices(actualSessionId);

      return Response.json({
        success: true,
        session: {
          id: session.id,
          code: session.code,
          currentProgressMs: session.currentProgressMs,
          isPlaying: session.isPlaying,
          devices: devices
        }
      });
    }

    if (action === 'update') {
      // Support both full sessionId and code
      let actualSessionId = sessionId;
      let session = null;

      if (sessionId && sessionId.length === 6) {
        session = await getSessionByCode(sessionId);
        if (!session) {
          return Response.json({ error: 'Invalid session code' }, { status: 404 });
        }
        actualSessionId = session.id;
      } else {
        session = await getSessionById(sessionId);
        if (!session) {
          return Response.json({ error: 'Session not found' }, { status: 404 });
        }
      }

      await updateSessionProgress(actualSessionId, deviceId, progressMs);

      return Response.json({ success: true });
    }

    if (action === 'get') {
      // Support both full sessionId and code
      let actualSessionId = sessionId;
      let session = null;

      if (sessionId && sessionId.length === 6) {
        session = await getSessionByCode(sessionId);
        if (!session) {
          return Response.json({ error: 'Invalid session code' }, { status: 404 });
        }
        actualSessionId = session.id;
      } else {
        session = await getSessionById(sessionId);
        if (!session) {
          return Response.json({ error: 'Session not found' }, { status: 404 });
        }
      }

      const devices = await getDevices(actualSessionId);

      return Response.json({
        id: session.id,
        code: session.code,
        currentProgressMs: session.currentProgressMs,
        isPlaying: session.isPlaying,
        devices: devices
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Sync session error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

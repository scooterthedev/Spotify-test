/**
 * @jest-environment node
 */
import { POST } from '@/app/api/sync/session/route';

// Helper to create mock requests
function createMockRequest(body) {
  return {
    json: async () => body,
  };
}

describe('Sync Session API', () => {
  beforeEach(() => {
    // Clear any state between tests - in real scenario, use a fresh server
    jest.resetModules();
  });

  describe('Create Session', () => {
    it('should create a new sync session with a code', async () => {
      const req = createMockRequest({ action: 'create' });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBeDefined();
      expect(data.code).toBeDefined();
      expect(data.code).toMatch(/^[A-F0-9]{6}$/);
      expect(data.code.length).toBe(6);
    });

    it('should generate unique codes for each session', async () => {
      const req1 = createMockRequest({ action: 'create' });
      const res1 = await POST(req1);
      const data1 = await res1.json();

      const req2 = createMockRequest({ action: 'create' });
      const res2 = await POST(req2);
      const data2 = await res2.json();

      expect(data1.code).not.toBe(data2.code);
      expect(data1.sessionId).not.toBe(data2.sessionId);
    });
  });

  describe('Join Session', () => {
    it('should join an existing session with full sessionId', async () => {
      // Create a session first
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { sessionId } = await createRes.json();

      // Join the session
      const joinReq = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_123',
        deviceName: 'Test Device',
        progressMs: 5000,
      });
      const joinRes = await POST(joinReq);
      const joinData = await joinRes.json();

      expect(joinRes.status).toBe(200);
      expect(joinData.success).toBe(true);
      expect(joinData.session.id).toBe(sessionId);
      expect(joinData.session.devices).toHaveLength(1);
      expect(joinData.session.devices[0].id).toBe('device_123');
      expect(joinData.session.devices[0].name).toBe('Test Device');
    });

    it('should join an existing session with code', async () => {
      // Create a session first
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { code } = await createRes.json();

      // Join the session using the code
      const joinReq = createMockRequest({
        action: 'join',
        sessionId: code,
        deviceId: 'device_456',
        deviceName: 'Another Device',
        progressMs: 10000,
      });
      const joinRes = await POST(joinReq);
      const joinData = await joinRes.json();

      expect(joinRes.status).toBe(200);
      expect(joinData.success).toBe(true);
      expect(joinData.session.devices).toHaveLength(1);
      expect(joinData.session.devices[0].id).toBe('device_456');
    });

    it('should allow multiple devices to join', async () => {
      // Create session
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { sessionId } = await createRes.json();

      // First device joins
      const join1 = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_1',
        deviceName: 'Device 1',
        progressMs: 0,
      });
      await POST(join1);

      // Second device joins
      const join2 = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_2',
        deviceName: 'Device 2',
        progressMs: 0,
      });
      const res2 = await POST(join2);
      const data2 = await res2.json();

      expect(data2.session.devices).toHaveLength(2);
      expect(data2.session.devices.map(d => d.id)).toEqual(['device_1', 'device_2']);
    });

    it('should return 404 for invalid session code', async () => {
      const joinReq = createMockRequest({
        action: 'join',
        sessionId: 'INVALID',
        deviceId: 'device_123',
        deviceName: 'Test Device',
        progressMs: 0,
      });
      const joinRes = await POST(joinReq);
      const joinData = await joinRes.json();

      expect(joinRes.status).toBe(404);
      // Code resolution returns "Session not found" when code doesn't map to a session
      expect(joinData.error).toMatch(/Invalid session code|Session not found/);
    });

    it('should return 404 for invalid full sessionId', async () => {
      const joinReq = createMockRequest({
        action: 'join',
        sessionId: 'invalidfullsessionid1234567890',
        deviceId: 'device_123',
        deviceName: 'Test Device',
        progressMs: 0,
      });
      const joinRes = await POST(joinReq);

      expect(joinRes.status).toBe(404);
    });
  });

  describe('Update Progress', () => {
    it('should update progress with full sessionId', async () => {
      // Create and join
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { sessionId } = await createRes.json();

      const joinReq = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_host',
        deviceName: 'Host',
        progressMs: 0,
      });
      await POST(joinReq);

      // Update progress
      const updateReq = createMockRequest({
        action: 'update',
        sessionId: sessionId,
        deviceId: 'device_host',
        progressMs: 30000,
      });
      const updateRes = await POST(updateReq);
      const updateData = await updateRes.json();

      expect(updateRes.status).toBe(200);
      expect(updateData.success).toBe(true);
    });

    it('should update progress with code', async () => {
      // Create and join
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { sessionId, code } = await createRes.json();

      const joinReq = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_host',
        deviceName: 'Host',
        progressMs: 0,
      });
      await POST(joinReq);

      // Update progress using code
      const updateReq = createMockRequest({
        action: 'update',
        sessionId: code,
        deviceId: 'device_host',
        progressMs: 45000,
      });
      const updateRes = await POST(updateReq);

      expect(updateRes.status).toBe(200);
    });

    it('should return 404 for update on non-existent session', async () => {
      const updateReq = createMockRequest({
        action: 'update',
        sessionId: 'INVALID',
        deviceId: 'device_123',
        progressMs: 30000,
      });
      const updateRes = await POST(updateReq);

      expect(updateRes.status).toBe(404);
    });

    it('should return 404 for update from device not in session', async () => {
      // Create and join
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { sessionId } = await createRes.json();

      const joinReq = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_1',
        deviceName: 'Device 1',
        progressMs: 0,
      });
      await POST(joinReq);

      // Try to update from different device
      const updateReq = createMockRequest({
        action: 'update',
        sessionId: sessionId,
        deviceId: 'device_2_not_joined',
        progressMs: 30000,
      });
      const updateRes = await POST(updateReq);

      expect(updateRes.status).toBe(404);
      expect((await updateRes.json()).error).toBe('Device not in session');
    });
  });

  describe('Get Session', () => {
    it('should get session state with full sessionId', async () => {
      // Create and join
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { sessionId } = await createRes.json();

      const joinReq = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_1',
        deviceName: 'Device 1',
        progressMs: 5000,
      });
      await POST(joinReq);

      // Get session
      const getReq = createMockRequest({
        action: 'get',
        sessionId: sessionId,
      });
      const getRes = await POST(getReq);
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.id).toBe(sessionId);
      expect(getData.devices).toHaveLength(1);
      expect(getData.devices[0].id).toBe('device_1');
    });

    it('should get session state with code', async () => {
      // Create and join
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { sessionId, code } = await createRes.json();

      const joinReq = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_1',
        deviceName: 'Device 1',
        progressMs: 0,
      });
      await POST(joinReq);

      // Get session using code
      const getReq = createMockRequest({
        action: 'get',
        sessionId: code,
      });
      const getRes = await POST(getReq);
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.devices).toHaveLength(1);
    });

    it('should return 404 for invalid session code', async () => {
      const getReq = createMockRequest({
        action: 'get',
        sessionId: 'INVALID',
      });
      const getRes = await POST(getReq);

      expect(getRes.status).toBe(404);
    });

    it('should track progress updates', async () => {
      // Create, join, and update
      const createReq = createMockRequest({ action: 'create' });
      const createRes = await POST(createReq);
      const { sessionId } = await createRes.json();

      const joinReq = createMockRequest({
        action: 'join',
        sessionId: sessionId,
        deviceId: 'device_1',
        deviceName: 'Device 1',
        progressMs: 0,
      });
      await POST(joinReq);

      const updateReq = createMockRequest({
        action: 'update',
        sessionId: sessionId,
        deviceId: 'device_1',
        progressMs: 60000,
      });
      await POST(updateReq);

      // Get and verify
      const getReq = createMockRequest({
        action: 'get',
        sessionId: sessionId,
      });
      const getRes = await POST(getReq);
      const getData = await getRes.json();

      expect(getData.currentProgressMs).toBe(60000);
      expect(getData.devices[0].progressMs).toBe(60000);
    });
  });

  describe('Invalid Actions', () => {
    it('should return 400 for invalid action', async () => {
      const req = createMockRequest({ action: 'invalid_action' });
      const res = await POST(req);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Invalid action');
    });

    it('should handle missing parameters gracefully', async () => {
      const req = createMockRequest({});
      const res = await POST(req);

      // Should handle undefined action
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});

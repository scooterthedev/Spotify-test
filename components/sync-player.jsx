"use client";
import { useEffect, useState, useRef } from "react";

export default function SyncPlayer({ songData, onSyncProgress }) {
  const [sessionId, setSessionId] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle');
  const deviceIdRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Generate unique device ID
  useEffect(() => {
    if (!deviceIdRef.current) {
      deviceIdRef.current = `device_${Math.random().toString(36).slice(2, 11)}`;
    }
  }, []);

  // Create sync session
  const createSession = async () => {
    try {
      setSyncStatus('creating');
      const res = await fetch('/api/sync/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' })
      });
      
      const data = await res.json();
      setSessionId(data.sessionId);
      setSessionCode(data.code);
      setIsHost(true);
      setSyncStatus('hosting');

      // Join as host
      await joinSession(data.sessionId, true);
    } catch (error) {
      console.error('Failed to create session:', error);
      setSyncStatus('error');
    }
  };

  // Join sync session
  const joinSession = async (sid, isHostJoin = false) => {
    try {
      setSyncStatus('joining');
      const res = await fetch('/api/sync/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          sessionId: sid,
          deviceId: deviceIdRef.current,
          deviceName: `Device ${deviceIdRef.current.slice(-4)}`,
          progressMs: songData?.progressMs || 0
        })
      });

      if (!res.ok) throw new Error('Failed to join session');

      const data = await res.json();
      setSessionId(sid);
      setIsHost(isHostJoin);
      setSyncStatus('synced');
      setConnectedDevices(data.session.devices);

      // Start polling for updates
      startPolling(sid);
    } catch (error) {
      console.error('Failed to join session:', error);
      setSyncStatus('error');
    }
  };

  // Start polling for session updates
  const startPolling = (sid) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/sync/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get', sessionId: sid })
        });

        if (!res.ok) return;

        const data = await res.json();
        setConnectedDevices(data.devices);

        // Update progress if not host (follow the sync stream)
        if (!isHost && data.currentProgressMs !== undefined) {
          onSyncProgress?.(data.currentProgressMs);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000);
  };

  // Send progress update (host only)
  useEffect(() => {
    if (!isHost || !sessionId || !songData?.progressMs) return;

    const updateProgress = async () => {
      try {
        await fetch('/api/sync/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            sessionId: sessionId,
            deviceId: deviceIdRef.current,
            progressMs: songData.progressMs
          })
        });
      } catch (error) {
        console.error('Failed to update progress:', error);
      }
    };

    const interval = setInterval(updateProgress, 500);
    return () => clearInterval(interval);
  }, [isHost, sessionId, songData?.progressMs]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  if (!sessionId) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm w-full">
        <h3 className="font-semibold text-lg text-black mb-4">Cross-Device Sync</h3>
        
        {syncStatus === 'error' && (
          <div className="text-red-600 text-sm mb-4">An error occurred</div>
        )}

        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600 mb-2">Start Syncing</p>
            <button
              onClick={createSession}
              disabled={syncStatus === 'creating'}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {syncStatus === 'creating' ? 'Creating...' : 'Create Sync Session'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-1">Join with Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                onClick={() => joinCode && joinSession(joinCode)}
                disabled={!joinCode || syncStatus === 'joining'}
                className="py-2 px-4 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {syncStatus === 'joining' ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-black">Synced Playback</h3>
        <div className="flex items-center gap-2 text-green-600">
          <span className="inline-block w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
          <span className="text-xs font-medium">Connected</span>
        </div>
      </div>

      {isHost && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <p className="text-xs font-semibold text-blue-900">Share Code</p>
          <p className="text-2xl font-mono font-bold text-blue-600 tracking-widest mt-1">
            {sessionCode}
          </p>
          <p className="text-xs text-blue-700 mt-2">
            Share this code with others to sync playback
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">
          Connected Devices ({connectedDevices.length})
        </p>
        <div className="space-y-2">
          {connectedDevices.map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm"
            >
              <span className="text-gray-700">{device.name}</span>
              <span className="text-xs text-gray-500">
                {Math.floor(device.progressMs / 1000)}s
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          setSessionId(null);
          setSessionCode(null);
          setIsHost(false);
          setJoinCode("");
          setSyncStatus('idle');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }}
        className="w-full mt-4 py-2 px-4 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition"
      >
        End Session
      </button>
    </div>
  );
}

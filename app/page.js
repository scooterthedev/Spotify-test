"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [stats, setStats] = useState(null);

  // Load stats on mount and refresh every minute
  useEffect(() => {
    async function loadStats() {
      try {
        const data = await fetch("/api/spotify/log").then(r => r.json());
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }
    loadStats();
    const statsInterval = setInterval(loadStats, 60000); // Refresh every minute
    return () => clearInterval(statsInterval);
  }, []);

  useEffect(() => {
    let lastProgressMs = null;
    async function logListeningData() {
      try {
        const now = await fetch("/api/spotify/me").then(r => r.json());
        
        // Log listening data if song is playing
        if (now && now.title && now.artist) {
          fetch("/api/spotify/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: now.title,
              artist: now.artist,
              album: now.album,
              progressMs: now.progressMs,
              durationMs: now.durationMs,
              playing: now.playing,
              uri: now.uri,
              lastProgressMs: lastProgressMs
            })
          }).catch(err => console.error('Failed to log listening data:', err));
          lastProgressMs = now.progressMs;
        }
       } catch (e) {
         console.error('Failed to fetch current song:', e);
       }
     }
     logListeningData();
     const logInterval = setInterval(logListeningData, 5000);
     return () => {
       clearInterval(logInterval);
     };
   }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 gap-6">
      {/* Listening Stats */}
      {stats && stats.summary && (
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Summary Stats */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-xl mb-4 text-black">Listening Stats</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                 <span className="text-gray-600">Total Time:</span>
                 <span className="font-mono font-semibold text-black">{Math.round(stats.summary.totalListeningHours * 60)}m</span>
               </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unique Songs:</span>
                <span className="font-mono font-semibold text-black">{stats.summary.totalSongs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Sessions:</span>
                <span className="font-mono font-semibold text-black">{stats.summary.totalSessions}</span>
              </div>
              {stats.summary.lastUpdated && (
                <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-200">
                  Last updated: {new Date(stats.summary.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Top Songs */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-xl mb-4 text-black">Top Songs</h2>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {stats.topSongs && stats.topSongs.slice(0, 10).map((song, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-gray-400 w-6">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-black truncate">{song.title}</div>
                    <div className="text-xs text-gray-500 truncate">{song.artist}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-semibold text-black">{song.playCount} plays</div>
                    <div className="font-mono text-xs text-gray-500">{(song.totalListeningTimeMs / 60000).toFixed(0)}m</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

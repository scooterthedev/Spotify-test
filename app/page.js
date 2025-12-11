"use client";
import { useEffect, useState } from "react";
import Spotify from "@/components/spotify";

export default function Home() {
  const [songdata, setsongData] = useState(null);
  const [songLoad, setSongLoad] = useState(true);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [stats, setStats] = useState(null);

  const reloadSpotify = () => {
    setReloadRequired(true);
  };

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
    let refreshing = false;
    let previousSongKey = null;
    let songStartTime = null;
    let listeningTimeMs = 0;

    async function logSongCompletion(song) {
      if (!song || !song.title || !song.artist) return;
      
      try {
        await fetch("/api/spotify/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: song.title,
            artist: song.artist,
            album: song.album,
            uri: song.uri,
            durationMs: song.durationMs,
            listeningTimeMs: listeningTimeMs
          })
        }).catch(err => console.error('Failed to log song:', err));
      } catch (e) {
        console.error('Error logging song completion:', e);
      }
    }

    async function load() {
      try {
        if (refreshing) return;
        setReloadRequired(false);
        setSongLoad(true);
        refreshing = true;
        const now = await fetch("/api/spotify/me").then(r => r.json());
        setsongData(now);
        
        if (now && now.title && now.artist) {
          const currentSongKey = `${now.title}|||${now.artist}`;
          
          // Song changed
          if (currentSongKey !== previousSongKey) {
            // Log previous song if exists
            if (previousSongKey) {
              const [prevTitle, prevArtist] = previousSongKey.split('|||');
              await logSongCompletion({
                title: prevTitle,
                artist: prevArtist,
                album: songdata?.album,
                uri: songdata?.uri,
                durationMs: songdata?.durationMs
              });
            }
            
            // Reset for new song
            previousSongKey = currentSongKey;
            songStartTime = Date.now();
            listeningTimeMs = 0;
          }
          
          // Update listening time if playing
          if (now.playing && songStartTime) {
            listeningTimeMs = Date.now() - songStartTime;
          }
          
          // Check if song finished (progress near end or playing changed to false)
          if (songdata && previousSongKey === currentSongKey) {
            const isFinished = 
              (now.progressMs >= now.durationMs - 1000) || // Song near end
              (!now.playing && songdata.playing); // Just paused
            
            if (isFinished && now.playing === false) {
              await logSongCompletion(now);
              previousSongKey = null;
            }
          }
        }
       } catch (e) {
         setsongData(prev => ({ ...prev, playing: false }));
       }
       setSongLoad(false);
       refreshing = false;
     }
     load();
     const syncInterval = setInterval(load, 5000);
     const reloadInterval = setInterval(() => {
       if (reloadRequired) {
         load();
       }
     }, 500);
     return () => {
       clearInterval(syncInterval);
       clearInterval(reloadInterval);
     };
   }, [reloadRequired, songdata]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 gap-6">
      <div className="w-full max-w-5xl">
        {songdata && songdata.title ? (
          <Spotify songData={songdata} loading={songLoad} onEnd={reloadSpotify} />
        ) : (
          <div className="text-center opacity-50">Not playing anything...</div>
        )}
      </div>

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

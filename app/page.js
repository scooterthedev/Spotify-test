"use client";
import { useEffect, useState } from "react";
import Spotify from "@/components/spotify";

export default function Home() {
  const [songdata, setsongData] = useState(null);
  const [songLoad, setSongLoad] = useState(true);
  const [reloadRequired, setReloadRequired] = useState(false);

  const reloadSpotify = () => {
    setReloadRequired(true);
  };

  useEffect(() => {
    let refreshing = false;
    async function load() {
      try {
        if (refreshing) return;
        setReloadRequired(false);
        setSongLoad(true);
        refreshing = true;
        const now = await fetch("/api/spotify/me").then(r => r.json());
        setsongData(now);
      } catch (e) {
        setsongData(prev => ({ ...prev, playing: false }));
      }
      setSongLoad(false);
      refreshing = false;
    }
    load();
    const syncInterval = setInterval(load, 10000);
    const reloadInterval = setInterval(() => {
      if (reloadRequired) {
        load();
      }
    }, 500);
    return () => {
      clearInterval(syncInterval);
      clearInterval(reloadInterval);
    };
  }, [reloadRequired]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        {songdata && songdata.title ? (
          <Spotify songData={songdata} loading={songLoad} onEnd={reloadSpotify} />
        ) : (
          <div className="text-center opacity-50">Not playing anything...</div>
        )}
      </div>
    </main>
  );
}

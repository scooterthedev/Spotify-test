"use client";
import { useEffect, useState } from "react";
import Spotify from "@/components/spotify";

export default function Home() {
  const [songdata, setsongData] = useState(null);
  const [songLoad, setSongLoad] = useState(true);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  const reloadSpotify = () => {
    setReloadRequired(true);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("spotify_access_token");
      if (stored) setAccessToken(stored);

      if (window.location.hash) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const token = params.get("access_token");
        if (token) {
          setAccessToken(token);
          localStorage.setItem("spotify_access_token", token);
          window.location.hash = "";
        }
      }
    }
  }, []);

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
  }, [reloadRequired]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        {songdata && songdata.title ? (
          <Spotify songData={songdata} loading={songLoad} onEnd={reloadSpotify} accessToken={accessToken} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center opacity-50">Not playing anything...</div>
            {accessToken && <div className="text-xs text-green-600">✓ Connected to Spotify</div>}
          </div>
        )}
      </div>
    </main>
  );
}

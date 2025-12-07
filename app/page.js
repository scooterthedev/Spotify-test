"use client";
import { useEffect, useState } from "react";
import Spotify from "@/components/spotify";

export default function Home() {
  const [songdata, setsongData] = useState(null);
  const [songLoad, setSongLoad] = useState(true);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [authStatus, setAuthStatus] = useState(null);

  const reloadSpotify = () => {
    setReloadRequired(true);
  };

  // Check for auth status from callback
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const auth = params.get("auth");
      const message = params.get("message");
      
      if (auth === "success") {
        setAuthStatus("success");
        // Clean up URL
        window.history.replaceState({}, document.title, "/");
        // Fetch token
        fetchToken();
      } else if (auth === "error") {
        setAuthStatus(`error: ${message}`);
        window.history.replaceState({}, document.title, "/");
      }
    }
  }, []);

  // Fetch access token from server
  const fetchToken = async () => {
    try {
      const response = await fetch('/api/spotify/token');
      
      if (!response.ok) {
        setAccessToken(null);
        setAuthStatus(null);
        return;
      }
      
      const data = await response.json();
      
      if (data.authenticated && data.access_token) {
        setAccessToken(data.access_token);
        setAuthStatus("connected");
      } else {
        setAccessToken(null);
        setAuthStatus(null);
      }
    } catch (error) {
      console.error("Failed to fetch token:", error);
      setAccessToken(null);
    }
  };

  // Check for existing token on mount
  useEffect(() => {
    fetchToken();
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
        {authStatus === "success" && (
          <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
            ✓ Successfully connected to Spotify
          </div>
        )}
        {authStatus && authStatus.startsWith("error") && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">
            ✗ {authStatus}
          </div>
        )}
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

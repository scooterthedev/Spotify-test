"use client";
import { useEffect, useState, useRef } from "react";

function fmt(ms) {
  if (ms == null) return "--";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (!h && !m) return `${sec.toString().padStart(2, "0")}s`;
  if (!h) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return [h, m, sec].map(v => String(v).padStart(2, "0")).join(":");
}

function parseLRC(lrc) {
  if (!lrc) return [];
  return lrc.split("\n").map(line => {
    const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
    if (!match) return null;
    const [, m, s, text] = match;
    return { time: (Number(m) * 60 + Number(s)) * 1000, text: text.trim() };
  }).filter(Boolean);
}

function getActiveLineIndex(parsedLyrics, progressMs) {
  if (!parsedLyrics.length || progressMs == null) return -1;
  let idx = parsedLyrics.findIndex((l, i) => {
    const next = parsedLyrics[i + 1];
    return progressMs >= l.time && (!next || progressMs < next.time);
  });
  return idx === -1 ? parsedLyrics.length - 1 : idx;
}

function convertPlainToSynced(lines, durationMs) {
  if (!lines?.length || !durationMs) return [];
  const totalPadding = 6000;
  const availableDuration = Math.max(durationMs - totalPadding, 0);
  const lengths = lines.map(l => l.length || 1);
  const totalLength = lengths.reduce((a, b) => a + b, 0);
  let cumulativeTime = 3000;
  return lines.map((text, i) => {
    const lineDuration = totalLength
      ? (lengths[i] / totalLength) * availableDuration
      : availableDuration / lines.length;
    const obj = { time: Math.floor(cumulativeTime), text: text.trim() };
    cumulativeTime += lineDuration;
    return obj;
  });
}

function getScriptFont(text) {
  return `Geist`;
}

export default function Spotify({ songData: songDataFromParent, loading: loadingFromParent, onEnd }) {
  const [localSongData, setLocalSongData] = useState(songDataFromParent);
  const [parsedLyrics, setParsedLyrics] = useState([]);
  const [unsynced, setUnsynced] = useState(false);
  const perfStartRef = useRef(performance.now());
  const [darkMode, setDarkMode] = useState(true); // Default to true for this standalone app
  const baseProgressRef = useRef(songDataFromParent?.progressMs || 0);
  const lastFetchedRef = useRef(null);
  const onEndCalledRef = useRef(false);
  const lyricsContainerRef = useRef(null);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (!localSongData || localSongData.percentage == null) return;

    if (localSongData.percentage >= 99.99 && !onEndCalledRef.current) {
      onEnd?.();
      onEndCalledRef.current = true;
    }
  }, [localSongData?.percentage, onEnd]);
  useEffect(() => {
    if (!localSongData) return;
    setParsedLyrics([]);
    setUnsynced(false);
    onEndCalledRef.current = false;

    const id = `${localSongData.title}_${localSongData.artist}`;
    if (lastFetchedRef.current === id) return;
    lastFetchedRef.current = id;

    const key = `lyric_${id}`.replaceAll(/\s+/g, "_").toLowerCase();
    const cached = localStorage.getItem(key);
    (async () => {
      try {
        let j;
        if (cached && false) {
          j = JSON.parse(cached);
        } else {
          const r = await fetch(`/api/spotify/lyrics?title=${encodeURIComponent(localSongData.title)}&artist=${encodeURIComponent(localSongData.artist)}`);
          if (!r.ok) return;
          j = await r.json();
          localStorage.setItem(key, JSON.stringify(j));
        }
        if (!j.synced && !j.plainLines) return;
        if (!j.synced && j.plainLines) setUnsynced(true);
        const payload = j.synced
          ? { synced: j.synced }
          : { plainLines: j.plainLines.split("\n").map(l => l.trim() || "♪") };
        const next = payload.synced
          ? parseLRC(payload.synced)
          : (localSongData.durationMs
            ? convertPlainToSynced(payload.plainLines || [], localSongData.durationMs)
            : (payload.plainLines || []).map(text => ({ time: 0, text })));
        setParsedLyrics(next);
      } catch (e) {
        console.error("Failed fetching lyrics", e);
      }
    })();
  }, [localSongData?.title, localSongData?.artist]);

  useEffect(() => {
    if (!songDataFromParent) return;
    setLocalSongData(songDataFromParent);
    perfStartRef.current = performance.now();
    baseProgressRef.current = songDataFromParent.progressMs || 0;
  }, [songDataFromParent]);

  useEffect(() => {
    const tick = setInterval(() => {
      setLocalSongData(d => {
        if (!d || !d.playing || d.progressMs == null || d.durationMs == null) return d;
        const elapsed = baseProgressRef.current + (performance.now() - perfStartRef.current);
        const capped = Math.min(elapsed, d.durationMs);
        return { ...d, progressMs: capped, percentage: Math.min((capped / d.durationMs) * 100, 100) };
      });
    }, 100);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!lyricsContainerRef.current || !parsedLyrics.length || !localSongData?.progressMs) return;

    const container = lyricsContainerRef.current;
    const activeIndex = typeof parsedLyrics[0] === "object"
      && getActiveLineIndex(parsedLyrics, localSongData.progressMs);

    const lineHeight = container.scrollHeight / parsedLyrics.length;
    const targetScroll = Math.max(0, lineHeight * (activeIndex - 2));

    container.scrollTo({ top: targetScroll, behavior: "smooth" });
  }, [localSongData?.progressMs, parsedLyrics]);


  if (!localSongData) return null;

  return (
    <div className={"flex flex-col gap-4 p-6 rounded-xl bg-white border border-gray-200 shadow-sm w-full text-left " + (localSongData.playing ? "" : "grayscale")}>
      <div className="font-semibold text-lg tracking-tight text-black">{localSongData.playing ? "Listening" : "Paused"}</div>

      <a href={localSongData.url || "#"} target="_blank" className="flex items-center gap-3 w-full truncate overflow-ellipsis">
        {localSongData.cover && <img src={localSongData.cover} alt="" className="w-16 h-16 rounded-md shadow-sm grayscale" />}
        <div className="flex flex-col leading-tight w-full">
          <div className="font-semibold text-black truncate">{localSongData.title || "Unknown Title"}</div>
          <div className="text-sm text-gray-600 truncate">{localSongData.artist || "Unknown Artist"}</div>
          {localSongData.album && <div className="text-xs text-gray-400 truncate">{localSongData.album}</div>}
        </div>
      </a>
      {localSongData.progressMs != null && localSongData.durationMs != null && (
        <div className="w-full grid grid-cols-1 gap-2">
          <div className="w-full h-1 bg-gray-200 rounded-md overflow-hidden">
            <div className="h-full transition-all bg-black" style={{ width: `${localSongData.percentage || 0}%` }} />
          </div>
          <div className="w-full flex justify-between text-gray-500">
            <div className="text-xs text-left font-mono">{(localSongData.progressMs / localSongData.durationMs * 100).toFixed(2)}%</div>
            <div className="text-xs text-right font-mono">{fmt(localSongData.progressMs)} / {fmt(localSongData.durationMs)}</div>
          </div>
        </div>
      )}
      {parsedLyrics.length > 0 && (
        <div className="flex flex-col">
          <div
            ref={lyricsContainerRef}
            className="mt-2 flex flex-col gap-1 max-h-40 text-md text-wrap wrap-break-word"
            style={{ overflow: "hidden", pointerEvents: "none" }}
          >
            {parsedLyrics.map((line, i) => {
              const text = typeof line === "object" ? line.text || "♪" : line || "♪";
              const font = getScriptFont(text);
              return (
                <div
                  key={i}
                  className={i === getActiveLineIndex(parsedLyrics, localSongData.progressMs)
                    ? "text-black font-bold"
                    : "text-gray-400"}
                >
                  {text}
                </div>
              );
            })}
          </div>
          {unsynced && <div className="text-xs text-gray-400 mt-2 text-right">Unsynced</div>}
        </div>
      )}
    </div>
  );
}

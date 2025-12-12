export async function GET() {
  // Block requests between midnight (00:00) and 10am (10:00) EST
  const estTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estTime.getHours();
  
  if (hour >= 0 && hour < 10) {
    return Response.json({ 
      playing: false, 
      blockedByTimeRestriction: true,
      message: "Spotify requests blocked between midnight and 10am EST"
    });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!tokenRes.ok)
    return new Response("token refresh fail", { status: 500 });

  const j = await tokenRes.json();
  const accessToken = j.access_token;

  const r = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (r.status === 204) return Response.json({ playing: false });

  if (!r.ok) return Response.json({ error: "fail" }, { status: 500 });

  const data = await r.json();
  const i = data.item;
  const progress = data.progress_ms;
  const duration = i.duration_ms;

  return Response.json({
    playing: data.is_playing,
    title: i.name,
    album: i.album.name,
    artist: i.artists.map((a) => a.name).join(", "),
    cover: i.album.images?.[0]?.url,
    url: i.external_urls.spotify,
    uri: i.uri,
    embed: `https://open.spotify.com/embed/track/${i.id}`,
    progressMs: progress,
    durationMs: duration,
    percentage: duration ? (progress / duration) * 100 : 0,
    startedAt: data.timestamp - progress,
    device: data.device
      ? {
          name: data.device.name,
          type: data.device.type,
          volume: data.device.volume_percent,
        }
      : null,
  });
}

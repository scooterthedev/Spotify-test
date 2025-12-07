export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  const artist = searchParams.get("artist");

  const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
  const r = await fetch(url);
  if (!r.ok) return Response.json({ synced: null });

  const list = await r.json();
  if (!list.length) return Response.json({ synced: null });

  return Response.json({ synced: list[0].syncedLyrics || null, plainLines: list[0].plainLyrics || null });
}

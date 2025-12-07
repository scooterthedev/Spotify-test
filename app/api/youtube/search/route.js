import yts from 'yt-search';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");
  const artist = searchParams.get("artist");

  if (!title || !artist) {
    return Response.json({ error: "Missing title or artist" }, { status: 400 });
  }

  const query = `${title} ${artist} audio`;
  
  try {
    const r = await yts(query);
    const videos = r.videos;

    if (!videos || videos.length === 0) {
      return Response.json({ videoId: null });
    }

    return Response.json({ videoId: videos[0].videoId });
  } catch (e) {
    console.error("YouTube search error:", e);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}

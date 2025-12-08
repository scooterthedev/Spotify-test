import { NextResponse } from 'next/server';
import yts from 'yt-search';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const artist = searchParams.get('artist');

  if (!title || !artist) {
    return NextResponse.json({ error: 'Missing title or artist' }, { status: 400 });
  }

  const query = `${title} ${artist} audio`;
  
  try {
    // Use yt-search (no API key needed)
    const result = await yts(query);
    
    if (result.videos && result.videos.length > 0) {
      const video = result.videos[0];
      console.log(`Found YouTube video for "${query}": ${video.title} (${video.videoId})`);
      
      return NextResponse.json({ 
        videoId: video.videoId,
        title: video.title,
        duration: video.seconds,
        url: video.url
      });
    }

    console.log(`No YouTube video found for "${query}"`);
    return NextResponse.json({ 
      videoId: null,
      error: 'No video found'
    });
  } catch (error) {
    console.error('YouTube search error:', error);
    return NextResponse.json({ 
      error: 'Search failed',
      videoId: null
    }, { status: 500 });
  }
}

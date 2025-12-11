import { NextResponse } from 'next/server';
import { logSongPlay, getListeningStats, getTotalListeningTime } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, artist, album, uri, durationMs, listeningTimeMs } = body;

    if (!title || !artist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Log the song play to database (only once per song completion)
    await logSongPlay(title, artist, album, uri, durationMs, listeningTimeMs);

    return NextResponse.json({ 
      success: true,
      totalListeningTimeMs: await getTotalListeningTime()
    });

  } catch (error) {
    console.error('Error logging song play:', error);
    return NextResponse.json({ error: 'Failed to log song play' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const stats = await getListeningStats(50);
    const totalListeningTimeMs = await getTotalListeningTime();
    
    // Calculate stats
    const totalSongs = stats.length;
    const totalHours = (totalListeningTimeMs / (1000 * 60 * 60)).toFixed(2);
    
    // Get total play count across all songs
    const totalPlays = stats.reduce((sum, song) => sum + song.times_listened, 0);
    
    return NextResponse.json({
      summary: {
        totalListeningTimeMs: totalListeningTimeMs,
        totalListeningHours: parseFloat(totalHours),
        totalSongs,
        totalPlays,
        lastUpdated: new Date().toISOString()
      },
      topSongs: stats.map(song => ({
        title: song.title,
        artist: song.artist,
        album: song.album,
        playCount: song.times_listened,
        totalListeningTimeMs: song.total_listening_time_ms,
        lastListeningTimeMs: song.listening_time_ms,
        firstPlayed: song.first_played,
        lastPlayed: song.last_played
      }))
    });

  } catch (error) {
    console.error('Error getting log data:', error);
    return NextResponse.json({ error: 'Failed to get log data' }, { status: 500 });
  }
}

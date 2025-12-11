import { NextResponse } from 'next/server';
import { logListeningSession, updateSongStats, getListeningStats, getTotalListeningTime, getRecentListeningHistory } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, artist, album, progressMs, durationMs, playing, uri, lastProgressMs } = body;

    if (!title || !artist) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Log the listening session to database
    await logListeningSession(title, artist, album, uri, progressMs, durationMs, playing);
    
    // Update song stats
    await updateSongStats(title, artist, album, uri, playing, progressMs, lastProgressMs);

    // Get updated stats
    const stats = await getListeningStats(1);
    const currentSongStats = stats.find(s => s.title === title && s.artist === artist) || {};

    return NextResponse.json({ 
      success: true,
      totalListeningTimeMs: await getTotalListeningTime(),
      songPlayCount: currentSongStats.play_count || 0,
      songListeningTimeMs: currentSongStats.total_listening_time_ms || 0
    });

  } catch (error) {
    console.error('Error logging listening data:', error);
    return NextResponse.json({ error: 'Failed to log data' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const stats = await getListeningStats(50);
    const totalListeningTimeMs = await getTotalListeningTime();
    const recentSessions = await getRecentListeningHistory(20);
    
    // Calculate stats
    const totalSongs = stats.length;
    const totalHours = (totalListeningTimeMs / (1000 * 60 * 60)).toFixed(2);
    
    return NextResponse.json({
      summary: {
        totalListeningTimeMs: totalListeningTimeMs,
        totalListeningHours: parseFloat(totalHours),
        totalSongs,
        totalSessions: recentSessions.length,
        lastUpdated: new Date().toISOString()
      },
      topSongs: stats.map(song => ({
        title: song.title,
        artist: song.artist,
        playCount: song.play_count,
        totalListeningTimeMs: song.total_listening_time_ms,
        firstPlayed: song.first_played,
        lastPlayed: song.last_played
      })),
      recentSessions
    });

  } catch (error) {
    console.error('Error getting log data:', error);
    return NextResponse.json({ error: 'Failed to get log data' }, { status: 500 });
  }
}

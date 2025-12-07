import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  const cookieStore = cookies();
  let accessToken = cookieStore.get('spotify_access_token')?.value;
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

  // If we have a valid access token, return it
  if (accessToken) {
    return NextResponse.json({ access_token: accessToken, authenticated: true });
  }

  // If no access token but we have a refresh token, get a new access token
  if (refreshToken) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error("Refresh token error:", data.error);
        return NextResponse.json({ authenticated: false, error: data.error }, { status: 401 });
      }

      // Set the new access token in a cookie
      const res = NextResponse.json({ access_token: data.access_token, authenticated: true });
      res.cookies.set('spotify_access_token', data.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: data.expires_in || 3600,
        path: '/'
      });

      // Update refresh token if a new one was provided
      if (data.refresh_token) {
        res.cookies.set('spotify_refresh_token', data.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
          path: '/'
        });
      }

      return res;
    } catch (err) {
      console.error("Token refresh error:", err);
      return NextResponse.json({ authenticated: false, error: 'server_error' }, { status: 500 });
    }
  }

  // No tokens available
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

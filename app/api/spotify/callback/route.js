import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

export async function GET(request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "https://localhost:3000/api/spotify/callback";
  
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  console.log("Callback Redirect URI:", redirectUri);

  if (error) {
    console.error("Spotify auth error:", error);
    return redirect(`/?auth=error&message=${error}`);
  }

  if (!code) {
    console.error("No code received");
    return redirect('/?auth=error&message=no_code');
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
  });

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = await response.json();
    console.log("Token exchange response:", data.error || "Success");

    if (data.error) {
      return redirect(`/?auth=error&message=${data.error}`);
    }

    // Store tokens in httpOnly cookies
    const res = NextResponse.redirect(new URL('/?auth=success', request.url));
    
    // Set access token (expires in ~1 hour)
    res.cookies.set('spotify_access_token', data.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: data.expires_in || 3600,
      path: '/'
    });
    
    // Set refresh token (long-lived)
    if (data.refresh_token) {
      res.cookies.set('spotify_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: '/'
      });
    }

    return res;
  } catch (err) {
    console.error("Token exchange error:", err);
    return redirect('/?auth=error&message=server_error');
  }
}

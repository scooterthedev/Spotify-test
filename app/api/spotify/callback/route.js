import { redirect } from 'next/navigation';

export async function GET(request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Determine the redirect URI based on the request host to support both localhost and IP
  const host = request.headers.get('host');
  const protocol = "https"; // We are forcing https
  const redirectUri = `${protocol}://${host}/api/spotify/callback`;

  console.log("Callback Redirect URI:", redirectUri);

  if (error) {
    return redirect(`/#error=${error}`);
  }

  if (!code) {
    return redirect('/#error=no_code');
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

    if (data.error) {
      return redirect(`/#error=${data.error}`);
    }

    // Redirect to home with the access token in the hash
    return redirect(`/#access_token=${data.access_token}`);
  } catch (err) {
    return redirect(`/#error=server_error`);
  }
}

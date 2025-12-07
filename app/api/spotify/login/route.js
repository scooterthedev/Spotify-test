import { redirect } from 'next/navigation';

export async function GET(request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  
  // Determine the redirect URI based on the request host to support both localhost and IP
  const host = request.headers.get('host');
  const protocol = "https"; // We are forcing https
  const redirectUri = `${protocol}://${host}/api/spotify/callback`;
  
  console.log("Using Redirect URI:", redirectUri); // Log for debugging

  const scope = "streaming user-read-email user-read-private user-modify-playback-state";
  
  const params = new URLSearchParams({
    response_type: "code", // Changed to 'code' for Authorization Code Flow
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
  });

  redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

import { redirect } from 'next/navigation';

export async function GET(request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || "https://localhost:3000/api/spotify/callback";
  
  console.log("Using Redirect URI:", redirectUri);

  const scope = "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";
  
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    show_dialog: "false"
  });

  redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}

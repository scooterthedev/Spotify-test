const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("--- Spotify Refresh Token Setup ---\n");
  console.log("1. Go to https://developer.spotify.com/dashboard");
  console.log("2. Create an app (or use an existing one).");
  console.log("3. In the app settings, add 'https://localhost:3000' to the Redirect URIs.");
  console.log("4. Copy the Client ID and Client Secret.\n");

  const clientId = await question("Enter Client ID: ");
  const clientSecret = await question("Enter Client Secret: ");

  const scopes = "user-read-currently-playing user-read-playback-state";
  const redirectUri = "https://192.168.68.106:3000";

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log(`\n5. Open this URL in your browser:\n\n${authUrl}\n`);
  console.log("6. Authorize the app. You will be redirected to localhost.");
  console.log("7. Copy the code from the URL (everything after '?code=').");

  const code = await question("\nEnter the code: ");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get token: ${response.status} ${text}`);
    }

    const data = await response.json();
    const refreshToken = data.refresh_token;

    console.log(`\nSuccess! Refresh Token: ${refreshToken}`);

    const envContent = `SPOTIFY_CLIENT_ID=${clientId}
SPOTIFY_CLIENT_SECRET=${clientSecret}
SPOTIFY_REFRESH_TOKEN=${refreshToken}
`;

    const envPath = path.join(__dirname, '..', '.env.local');
    fs.writeFileSync(envPath, envContent);
    console.log(`\nSaved credentials to ${envPath}`);
    console.log("\nYou can now run 'npm run dev' to start the app.");

  } catch (error) {
    console.error("\nError:", error.message);
  } finally {
    rl.close();
  }
}

main();

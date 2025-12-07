# Spotify Listener

This is a standalone Next.js application that displays your currently playing Spotify track and synced lyrics.

## Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Copy `.env.local.example` to `.env.local` and fill in the values.

    -   **Spotify Credentials:**
        -   Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
        -   Create an app.
        -   Get `Client ID` and `Client Secret`.
        -   Add `http://localhost:3000` (or your production URL) to Redirect URIs.
        -   You need to obtain a `refresh_token` manually (e.g. using a tool or script) and add it as `SPOTIFY_REFRESH_TOKEN`.

3.  **Run the app:**
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser.

## How it works

-   `components/spotify.jsx`: The main component that renders the player and lyrics.
-   `app/api/spotify/me/route.js`: Fetches the currently playing track from Spotify API.
-   `app/api/spotify/lyrics/route.js`: Fetches lyrics from `lrclib.net`.

import "./globals.css";

export const metadata = {
  title: "Spotify Listener",
  description: "A minimal Spotify listener component",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

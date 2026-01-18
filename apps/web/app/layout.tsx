import type { Metadata } from "next";
import "./globals.css";
import { AudioProvider } from "../contexts/audio-context";
import { AudioControls } from "../components/audio-controls";

export const metadata: Metadata = {
  title: "Leet99 - Battle Royale for Coders",
  description:
    "Tetris 99 meets LeetCode. Race to solve problems, attack opponents, and be the last coder standing.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="leet99">
      <head>
        {/* IBM Plex fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-base-100 text-base-content antialiased">
        <AudioProvider>
          <AudioControls />
          {children}
        </AudioProvider>
      </body>
    </html>
  );
}

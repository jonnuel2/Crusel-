import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crusel — a profit-taking agent that keeps score",
  description:
    "Crusel watches a position and calls the exit. It does not hold your funds. Every call it makes is public, including the ones nobody took.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="grid-field" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}

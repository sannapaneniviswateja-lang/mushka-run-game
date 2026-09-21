import type { Metadata, Viewport } from "next";
import "../index.css";

export const metadata: Metadata = {
  title: "Mushak Run — Ganesha's Snowy Adventure",
  description: "Guide Ganesha and Mushak through a snowy Himalayan adventure. Collect laddus and grow through four stages!",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Mushak Run",
    description: "Guide Ganesha and Mushak through a snowy Himalayan adventure. Collect laddus and grow through four stages!",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b82c4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}

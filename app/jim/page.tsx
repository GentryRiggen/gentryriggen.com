import type { Metadata, Viewport } from "next";
import JimGate from "@/components/jim/JimGate";

export const metadata: Metadata = {
  title: "Jim",
  description: "Private chat.",
  robots: { index: false, follow: false },
  // Replace the layout's homepage canonical and share cards.
  alternates: { canonical: "https://gentryriggen.com/jim" },
  openGraph: {
    title: "Jim",
    description: "Private chat.",
    url: "https://gentryriggen.com/jim",
    type: "website",
  },
  twitter: { card: "summary", title: "Jim", description: "Private chat." },
  // Home-screen app: only this route links the manifest.
  manifest: "/jim.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Jim",
    // "default" keeps the status bar out of the page and lets it take the
    // theme color below (Ayu Mirage's background).
    statusBarStyle: "default",
  },
  // Next renders `capable` as mobile-web-app-capable; older iOS versions only
  // read the apple- prefixed tag. Replaces the layout's `other`, which asks
  // for a translucent status bar.
  other: { "apple-mobile-web-app-capable": "yes" },
  // Page icons replace the layout's, so the favicon is repeated here. Versioned file names: iOS and
  // Safari keep an icon by its URL, so a new icon gets a new name.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [
      {
        url: "/jim-icons/glow-pal-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android Chrome: shrink the page for the keyboard (iOS ignores this; the
  // chat follows the visual viewport there instead).
  interactiveWidget: "resizes-content",
  // Ayu Mirage in light and dark alike; the page draws it the same way.
  themeColor: "#1f2430",
  colorScheme: "dark",
};

export default function JimPage() {
  return <JimGate />;
}

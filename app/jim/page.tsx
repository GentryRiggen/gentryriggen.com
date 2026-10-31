import type { Metadata, Viewport } from "next";
import JimGate from "@/components/jim/JimGate";

export const metadata: Metadata = {
  title: "Jim",
  description: "Private chat.",
  robots: { index: false, follow: false },
  // Home-screen app: only this route links the manifest.
  manifest: "/jim.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Jim",
    // "default" keeps the status bar out of the page and lets it take the
    // theme color below, so it matches light and dark mode.
    statusBarStyle: "default",
  },
  // Next renders `capable` as mobile-web-app-capable; older iOS versions only
  // read the apple- prefixed tag. Replaces the layout's `other`, which asks
  // for a translucent status bar.
  other: { "apple-mobile-web-app-capable": "yes" },
  // Page icons replace the layout's, so the favicon is repeated here.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [
      {
        url: "/jim-icons/apple-touch-icon.png",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
};

export default function JimPage() {
  return <JimGate />;
}

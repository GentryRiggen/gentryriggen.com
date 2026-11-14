import type { Metadata, Viewport } from "next";
import PlanetSmasher from "@/components/planet-smasher/PlanetSmasher";

const description =
  "Smash planets with asteroids and more, and watch the people on them scatter. A silly 3D game for tablets and computers.";

export const metadata: Metadata = {
  title: "Planet Smasher | Gentry Riggen",
  description,
  alternates: { canonical: "https://gentryriggen.com/planet-smasher" },
  openGraph: {
    title: "Planet Smasher",
    description,
    url: "https://gentryriggen.com/planet-smasher",
    siteName: "Gentry Riggen",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Planet Smasher",
    description,
  },
  // Home-screen app: only this route links the manifest, so the rest of the
  // site stays an ordinary website.
  manifest: "/planet-smasher.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Planet Smasher",
    statusBarStyle: "black-translucent",
  },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [
      {
        url: "/planet-smasher-icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#05060f",
};

export default function PlanetSmasherPage() {
  return <PlanetSmasher />;
}

import type { Metadata, Viewport } from "next";
import Flamelings from "@/components/flamelings/Flamelings";

const description =
  "Hatch a little flame pet, feed it, play with it and dress it up. A cozy Tamagotchi-style game for tablets and phones.";

export const metadata: Metadata = {
  title: "Flamelings | Gentry Riggen",
  description,
  alternates: { canonical: "https://gentryriggen.com/flamelings" },
  openGraph: {
    title: "Flamelings",
    description,
    url: "https://gentryriggen.com/flamelings",
    siteName: "Gentry Riggen",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary", title: "Flamelings", description },
  // Home-screen app: only this route links the manifest.
  manifest: "/flamelings.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Flamelings",
    statusBarStyle: "black-translucent",
  },
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [
      {
        url: "/flamelings-icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#2a1a4a",
};

export default function FlamelingsPage() {
  return <Flamelings />;
}

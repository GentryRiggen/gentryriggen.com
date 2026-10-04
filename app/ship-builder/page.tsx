import type { Metadata, Viewport } from "next";
import ShipBuilder from "@/components/ship-builder/ShipBuilder";

const description =
  "Build your own Titanic-era ocean liner from snap-together parts, then check whether there are enough lifeboats.";

export const metadata: Metadata = {
  title: "Ship Builder | Gentry Riggen",
  description,
  alternates: { canonical: "https://gentryriggen.com/ship-builder" },
  openGraph: {
    title: "Ship Builder",
    description,
    url: "https://gentryriggen.com/ship-builder",
    siteName: "Gentry Riggen",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Ship Builder",
    description,
  },
  // Home-screen app: only this route links the manifest, so the rest of the
  // site stays an ordinary website.
  manifest: "/ship-builder.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ship Builder",
    statusBarStyle: "black-translucent",
  },
  // Next renders `capable` as mobile-web-app-capable; older iOS versions only
  // read the apple- prefixed tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  // Page icons replace the layout's, so the favicon is repeated here.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [
      {
        url: "/ship-builder-icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1f4e6e",
};

export default function ShipBuilderPage() {
  return <ShipBuilder />;
}

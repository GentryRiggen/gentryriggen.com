import type { Metadata, Viewport } from "next";
import EverOnward from "@/components/ever-onward/EverOnward";

const description =
  "Little machines. One simple goal each. Ever onward. An incremental game where a lighthouse robot keeps the light on.";

export const metadata: Metadata = {
  title: "Ever Onward | Gentry Riggen",
  description,
  alternates: { canonical: "https://gentryriggen.com/ever-onward" },
  openGraph: {
    title: "Ever Onward",
    description,
    url: "https://gentryriggen.com/ever-onward",
    siteName: "Gentry Riggen",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Ever Onward",
    description,
  },
  // Home-screen app: only this route links the manifest, so the rest of the
  // site stays an ordinary website.
  manifest: "/ever-onward.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ever Onward",
    statusBarStyle: "black-translucent",
  },
  // Next renders `capable` as mobile-web-app-capable; older iOS versions only
  // read the apple- prefixed tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/ever-onward-icons/icon.svg", type: "image/svg+xml" }],
    apple: [
      {
        url: "/ever-onward-icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function EverOnwardPage() {
  return <EverOnward />;
}

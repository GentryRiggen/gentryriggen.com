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
  // Page icons replace the layout's, so the favicon is repeated here.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function EverOnwardPage() {
  return <EverOnward />;
}

import type { Metadata, Viewport } from "next";
import PlaneBuilder from "@/components/plane-builder/PlaneBuilder";

const description =
  "Launch a plane from a slingshot, earn coins, upgrade it and fly all the way to the finish line.";

export const metadata: Metadata = {
  title: "Plane Builder | Gentry Riggen",
  description,
  alternates: { canonical: "https://gentryriggen.com/plane-builder" },
  openGraph: {
    title: "Plane Builder",
    description,
    url: "https://gentryriggen.com/plane-builder",
    siteName: "Gentry Riggen",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Plane Builder",
    description,
  },
  // Page icons replace the layout's, so the favicon is repeated here.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2b6cb0",
};

export default function PlaneBuilderPage() {
  return <PlaneBuilder />;
}

import type { Metadata, Viewport } from "next";
import LittleMachines from "@/components/little-machines/LittleMachines";

const description =
  "Little machines. One simple goal each. Much too far. An incremental game where a lighthouse robot keeps the light on.";

export const metadata: Metadata = {
  title: "Little Machines | Gentry Riggen",
  description,
  alternates: { canonical: "https://gentryriggen.com/little-machines" },
  openGraph: {
    title: "Little Machines",
    description,
    url: "https://gentryriggen.com/little-machines",
    siteName: "Gentry Riggen",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Little Machines",
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

export default function LittleMachinesPage() {
  return <LittleMachines />;
}

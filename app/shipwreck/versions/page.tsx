import type { Metadata, Viewport } from "next";
import { SHIPWRECK_THEME_COLOR } from "@/lib/theme/themeScript";
import VersionHistory from "@/components/shipwreck/VersionHistory";

const description = "What changed in each release of Shipwreck.";

export const metadata: Metadata = {
  title: "What's new | Shipwreck",
  description,
  alternates: { canonical: "https://gentryriggen.com/shipwreck/versions" },
};

export const viewport: Viewport = {
  themeColor: SHIPWRECK_THEME_COLOR,
};

export default function ShipwreckVersionsPage() {
  return <VersionHistory />;
}

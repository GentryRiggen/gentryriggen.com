import type { Metadata, Viewport } from "next";
import VersionHistory from "@/components/planet-smasher/VersionHistory";

const description = "What changed in each release of Planet Smasher.";

export const metadata: Metadata = {
  title: "What's new | Planet Smasher",
  description,
  alternates: { canonical: "https://gentryriggen.com/planet-smasher/versions" },
};

export const viewport: Viewport = {
  themeColor: "#05060f",
};

export default function PlanetSmasherVersionsPage() {
  return <VersionHistory />;
}

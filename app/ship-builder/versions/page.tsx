import type { Metadata, Viewport } from "next";
import VersionHistory from "@/components/ship-builder/VersionHistory";

const description = "What changed in each release of Ship Builder.";

export const metadata: Metadata = {
  title: "What's new | Ship Builder",
  description,
  alternates: { canonical: "https://gentryriggen.com/ship-builder/versions" },
};

export const viewport: Viewport = {
  themeColor: "#1f4e6e",
};

export default function ShipBuilderVersionsPage() {
  return <VersionHistory />;
}

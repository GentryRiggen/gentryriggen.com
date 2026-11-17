import type { Metadata, Viewport } from "next";
import VersionHistory from "@/components/flamelings/VersionHistory";

const description = "What changed in each release of Flamelings.";

export const metadata: Metadata = {
  title: "What's new | Flamelings",
  description,
  alternates: { canonical: "https://gentryriggen.com/flamelings/versions" },
};

export const viewport: Viewport = {
  themeColor: "#2a1a4a",
};

export default function FlamelingsVersionsPage() {
  return <VersionHistory />;
}

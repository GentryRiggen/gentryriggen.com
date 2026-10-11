import type { Metadata, Viewport } from "next";
import VersionHistory from "@/components/plane-builder/VersionHistory";

const description = "What changed in each release of Plane Builder.";

export const metadata: Metadata = {
  title: "What's new | Plane Builder",
  description,
  alternates: { canonical: "https://gentryriggen.com/plane-builder/versions" },
};

export const viewport: Viewport = {
  themeColor: "#2b6cb0",
};

export default function PlaneBuilderVersionsPage() {
  return <VersionHistory />;
}

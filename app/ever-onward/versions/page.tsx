import type { Metadata, Viewport } from "next";
import VersionHistory from "@/components/ever-onward/VersionHistory";

const description = "What changed in each release of Ever Onward.";

export const metadata: Metadata = {
  title: "What's new | Ever Onward",
  description,
  alternates: {
    canonical: "https://gentryriggen.com/ever-onward/versions",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function EverOnwardVersionsPage() {
  return <VersionHistory />;
}

import type { Metadata, Viewport } from "next";
import VersionHistory from "@/components/little-machines/VersionHistory";

const description = "What changed in each release of Little Machines.";

export const metadata: Metadata = {
  title: "What's new | Little Machines",
  description,
  alternates: {
    canonical: "https://gentryriggen.com/little-machines/versions",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function LittleMachinesVersionsPage() {
  return <VersionHistory />;
}

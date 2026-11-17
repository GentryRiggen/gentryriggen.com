import type { Metadata, Viewport } from "next";
import { FLAMELINGS_THEME_COLOR } from "@/lib/theme/themeScript";
import VersionHistory from "@/components/flamelings/VersionHistory";

const description = "What changed in each release of Flamelings.";

export const metadata: Metadata = {
  title: "What's new | Flamelings",
  description,
  alternates: { canonical: "https://gentryriggen.com/flamelings/versions" },
};

export const viewport: Viewport = {
  themeColor: FLAMELINGS_THEME_COLOR,
};

export default function FlamelingsVersionsPage() {
  return <VersionHistory />;
}

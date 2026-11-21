import Shipwreck from "@/components/shipwreck/Shipwreck";
import { gameMetadata } from "@/lib/game-kit/metadata";
import { SHIPWRECK_THEME_COLOR } from "@/lib/theme/themeScript";

export const { metadata, viewport } = gameMetadata({
  slug: "shipwreck",
  title: "Shipwreck",
  description:
    "A realistic sinking-ship simulator. Watch the Titanic's last night unfold, or open the hull yourself and see if she stays afloat.",
  themeColor: SHIPWRECK_THEME_COLOR,
  // Opaque: the controls are pinned to the edges, and translucent blurs them.
  statusBar: "black",
  iconVersion: 1,
});

export default function ShipwreckPage() {
  return <Shipwreck />;
}

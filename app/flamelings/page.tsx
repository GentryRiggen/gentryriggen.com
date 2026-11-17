import Flamelings from "@/components/flamelings/Flamelings";
import { gameMetadata } from "@/lib/game-kit/metadata";
import { FLAMELINGS_THEME_COLOR } from "@/lib/theme/themeScript";

export const { metadata, viewport } = gameMetadata({
  slug: "flamelings",
  title: "Flamelings",
  description:
    "Hatch a little flame pet, feed it, play with it and dress it up. A cozy Tamagotchi-style game for tablets and phones.",
  themeColor: FLAMELINGS_THEME_COLOR,
  // Opaque: the pet's top bar is pinned, and translucent blurs it (Ever Onward).
  statusBar: "black",
  iconVersion: 1,
});

export default function FlamelingsPage() {
  return <Flamelings />;
}

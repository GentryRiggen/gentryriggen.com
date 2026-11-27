import Home from "@/components/designs/design1/Home";
import { summarizeReleases } from "@/components/designs/design1/releases";
import { CHANGELOG as EVER_ONWARD } from "@/lib/ever-onward/changelog";
import { CHANGELOG as FLAMELINGS } from "@/lib/flamelings/changelog";
import { CHANGELOG as PLANE_BUILDER } from "@/lib/plane-builder/changelog";
import { CHANGELOG as PLANET_SMASHER } from "@/lib/planet-smasher/changelog";
import { CHANGELOG as SHIP_BUILDER } from "@/lib/ship-builder/changelog";
import { CHANGELOG as SHIPWRECK } from "@/lib/shipwreck/changelog";

/**
 * Server component: reads every changelog at build time and hands the
 * homepage only the latest releases, so the changelogs stay out of its
 * bundle.
 */
export default function Page() {
  const shipped = summarizeReleases({
    "ever-onward": EVER_ONWARD,
    flamelings: FLAMELINGS,
    "plane-builder": PLANE_BUILDER,
    "planet-smasher": PLANET_SMASHER,
    "ship-builder": SHIP_BUILDER,
    shipwreck: SHIPWRECK,
  });
  return <Home shipped={shipped} />;
}

import { SHIPWRECK_VERSION } from "@/lib/shipwreck/version";
import { versionRoute } from "@/lib/game-kit/versionRoute";

// Static export: written to out/shipwreck/version.json at build time.
export const dynamic = "force-static";
export const GET = versionRoute(SHIPWRECK_VERSION);

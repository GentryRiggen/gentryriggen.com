import { FLAMELINGS_VERSION } from "@/lib/flamelings/version";
import { versionRoute } from "@/lib/game-kit/versionRoute";

// Static export: written to out/flamelings/version.json at build time.
export const dynamic = "force-static";
export const GET = versionRoute(FLAMELINGS_VERSION);

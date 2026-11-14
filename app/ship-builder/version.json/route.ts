import { SHIP_BUILDER_VERSION } from "@/lib/ship-builder/version";

// Static export: this is written to out/ship-builder/version.json at build
// time. The running game compares its own build id to this file's.
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      version: SHIP_BUILDER_VERSION,
      build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
    },
    { headers: { "Cache-Control": "no-cache" } }
  );
}

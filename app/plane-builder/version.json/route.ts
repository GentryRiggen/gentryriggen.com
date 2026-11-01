import { PLANE_BUILDER_VERSION } from "@/lib/plane-builder/version";

// Static export: this is written to out/plane-builder/version.json at build
// time. The running game compares its own build id to this file's.
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      version: PLANE_BUILDER_VERSION,
      build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
    },
    { headers: { "Cache-Control": "no-cache" } }
  );
}

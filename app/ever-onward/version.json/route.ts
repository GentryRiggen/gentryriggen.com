import { EVER_ONWARD_VERSION } from "@/lib/ever-onward/version";

// Static export: this is written to out/ever-onward/version.json at build
// time. The running game compares its own build id to this file's.
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      version: EVER_ONWARD_VERSION,
      build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
    },
    { headers: { "Cache-Control": "no-cache" } }
  );
}

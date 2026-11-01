// Static export: written to out/jim/version.json at build time. The running
// Jim page compares its own build id to this file's.
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-cache" } }
  );
}

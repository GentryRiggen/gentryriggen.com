/**
 * The handler of a game's `app/<slug>/version.json/route.ts`. The running game
 * compares its own build id to this file's (components/update), so a deploy
 * reaches a game left open on an iPad.
 *
 *   export const dynamic = "force-static"; // must be a literal in the route
 *   export const GET = versionRoute(MY_GAME_VERSION);
 */
export function versionRoute(version: string) {
  return function GET(): Response {
    return Response.json(
      { version, build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
      { headers: { "Cache-Control": "no-cache" } }
    );
  };
}

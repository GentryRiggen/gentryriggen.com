import { agentProfile } from "@/components/designs/design1/agentProfile";
import { CHANGELOGS } from "@/components/designs/design1/changelogs";
import { summarizeReleases } from "@/components/designs/design1/releases";

export const dynamic = "force-static";

/** /llms.txt: the homepage as Markdown, for AI agents. */
export function GET() {
  return new Response(agentProfile(summarizeReleases(CHANGELOGS)), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

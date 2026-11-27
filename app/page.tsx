import Home from "@/components/designs/design1/Home";
import { CHANGELOGS } from "@/components/designs/design1/changelogs";
import { summarizeReleases } from "@/components/designs/design1/releases";

/**
 * Server component: reads every changelog at build time and hands the
 * homepage only the latest releases, so the changelogs stay out of its
 * bundle.
 */
export default function Page() {
  return <Home shipped={summarizeReleases(CHANGELOGS)} />;
}

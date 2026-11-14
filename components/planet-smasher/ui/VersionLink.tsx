import Link from "next/link";
import { PLANET_SMASHER_VERSION } from "@/lib/planet-smasher/version";

/** A small "what's new" link under the planet picker. */
export default function VersionLink() {
  return (
    <Link
      href="/planet-smasher/versions"
      className="mt-2 inline-flex min-h-11 items-center rounded-full bg-black/40 px-3 text-sm font-medium text-white/80 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      What&apos;s new · v{PLANET_SMASHER_VERSION}
    </Link>
  );
}

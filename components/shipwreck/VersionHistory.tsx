import Link from "next/link";
import { CHANGELOG } from "@/lib/shipwreck/changelog";
import { SHIPWRECK_VERSION } from "@/lib/shipwreck/version";
import { SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "@/lib/game-kit/safeArea";
import { PARENT_LINES } from "./parentLine";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

export default function VersionHistory() {
  return (
    <div
      className={`min-h-[100dvh] bg-[#05080f] text-slate-100 ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3 py-2">
          <Link
            href="/shipwreck"
            className="inline-flex min-h-16 shrink-0 items-center rounded-full border border-slate-700 bg-slate-900 px-5 text-lg font-semibold text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <span aria-hidden="true">←</span>
            <span className="ml-2">Back to Shipwreck</span>
          </Link>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold sm:text-4xl">What&apos;s new</h1>
            <p className="text-base text-slate-400">
              You&apos;re on v{SHIPWRECK_VERSION}
            </p>
          </div>
        </header>
        <main className="space-y-5 py-5">
          {CHANGELOG.map((release) => (
            <article
              key={release.version}
              aria-labelledby={`release-${release.version}`}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2
                  id={`release-${release.version}`}
                  className="text-xl font-semibold"
                >
                  <span className="mr-1 rounded-full bg-sky-900 px-3 py-0.5 text-sky-100">
                    v{release.version}
                  </span>{" "}
                  {release.title}
                </h2>
                <time
                  dateTime={release.date}
                  className="text-sm text-slate-400"
                >
                  {formatDate(release.date)}
                </time>
              </div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base text-slate-200 marker:text-sky-400">
                {release.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
          ))}
        </main>
        <div className="flex flex-col gap-1 pb-6 text-sm text-slate-400">
          {Object.entries(PARENT_LINES).map(([id, line]) => (
            <p key={id}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { CHANGELOG } from "@/lib/flamelings/changelog";
import { FLAMELINGS_VERSION } from "@/lib/flamelings/version";

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 dark:focus-visible:ring-orange-300";

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
    <div className="min-h-[100dvh] bg-amber-50 text-stone-900 dark:bg-slate-950 dark:text-amber-50">
      <header className="border-b border-amber-200 bg-white pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/flamelings"
          className={`rounded text-sm text-stone-600 hover:text-stone-900 dark:text-amber-200/80 dark:hover:text-white ${focusRingClass}`}
        >
          ← Back to Flamelings
        </Link>
        <h1 className="mt-1 text-xl font-semibold">What&apos;s new</h1>
        <p className="text-sm text-stone-600 dark:text-amber-200/80">
          You&apos;re on v{FLAMELINGS_VERSION}
        </p>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {CHANGELOG.map((release) => (
          <article
            key={release.version}
            aria-labelledby={`release-${release.version}`}
            className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2
                id={`release-${release.version}`}
                className="text-lg font-semibold"
              >
                <span className="font-mono text-orange-700 dark:text-orange-300">
                  v{release.version}
                </span>{" "}
                · {release.title}
              </h2>
              <time
                dateTime={release.date}
                className="text-sm text-stone-500 dark:text-amber-200/70"
              >
                {formatDate(release.date)}
              </time>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700 dark:text-amber-100/90">
              {release.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </article>
        ))}
      </main>
    </div>
  );
}

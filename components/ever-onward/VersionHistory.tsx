import Link from "next/link";
import { CHANGELOG } from "@/lib/ever-onward/changelog";
import { EVER_ONWARD_VERSION } from "@/lib/ever-onward/version";
import { focusRingClass } from "./styles";

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
    <div className="min-h-dvh bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 pl-4 pr-20 dark:border-slate-800 dark:bg-slate-900">
        <Link
          href="/ever-onward"
          className={`rounded text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white ${focusRingClass}`}
        >
          ← Back to Ever Onward
        </Link>
        <h1 className="mt-1 text-xl font-semibold">What&apos;s new</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          You&apos;re on v{EVER_ONWARD_VERSION}
        </p>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {CHANGELOG.map((release) => (
          <article
            key={release.version}
            aria-labelledby={`release-${release.version}`}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2
                id={`release-${release.version}`}
                className="text-lg font-semibold"
              >
                <span className="font-mono text-amber-700 dark:text-amber-400">
                  v{release.version}
                </span>{" "}
                · {release.title}
              </h2>
              <time
                dateTime={release.date}
                className="text-sm text-slate-500 dark:text-slate-400"
              >
                {formatDate(release.date)}
              </time>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
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

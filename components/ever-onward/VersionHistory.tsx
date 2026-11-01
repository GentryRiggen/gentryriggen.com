import Link from "next/link";
import { CHANGELOG } from "@/lib/ever-onward/changelog";
import { EVER_ONWARD_VERSION } from "@/lib/ever-onward/version";
import RetroLabel from "./start/RetroLabel";
import RetroPage from "./start/RetroPage";
import {
  retroHeadingClass,
  retroLinkClass,
  retroPanelClass,
} from "./start/retroStyles";

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
    <RetroPage>
      <main className="eo-fade-in relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <header className="flex flex-col gap-4">
          <Link
            href="/ever-onward"
            className={`self-start font-mono text-sm text-slate-200 ${retroLinkClass}`}
          >
            ← Back to Ever Onward
          </Link>
          <h1>
            <RetroLabel
              label="What's new"
              className={`text-xl ${retroHeadingClass}`}
            />
          </h1>
          <p className="font-mono text-sm text-cyan-100">
            You&apos;re on v{EVER_ONWARD_VERSION}
          </p>
        </header>
        {CHANGELOG.map((release) => (
          <article
            key={release.version}
            aria-labelledby={`release-${release.version}`}
            className={`${retroPanelClass} p-4`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2
                id={`release-${release.version}`}
                className="font-mono text-base font-bold text-amber-50"
              >
                <span className="text-amber-300">v{release.version}</span> ·{" "}
                {release.title}
              </h2>
              <time
                dateTime={release.date}
                className="font-mono text-xs text-slate-300"
              >
                {formatDate(release.date)}
              </time>
            </div>
            <ul className="mt-3 space-y-2 font-mono text-sm text-slate-100">
              {release.highlights.map((highlight) => (
                <li key={highlight} className="flex gap-2">
                  <span aria-hidden="true" className="text-amber-300">
                    ▶︎
                  </span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </main>
    </RetroPage>
  );
}

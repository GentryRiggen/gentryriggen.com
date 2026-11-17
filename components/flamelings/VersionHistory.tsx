import Link from "next/link";
import { CHANGELOG } from "@/lib/flamelings/changelog";
import { FLAMELINGS_VERSION } from "@/lib/flamelings/version";
import FlIcon from "./FlIcon";
import {
  CHROME_BG,
  DISPLAY,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  STICKER,
  STICKER_BUTTON,
} from "./styles";

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
      className={`min-h-[100dvh] ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="fl-sheet-up mx-auto max-w-2xl">
        <header className="flex items-center gap-3 py-2">
          <Link
            href="/flamelings"
            aria-label="Back to Flamelings"
            className={`${STICKER_BUTTON} size-16 shrink-0`}
          >
            <FlIcon name="back" className="size-8" />
          </Link>
          <div className="min-w-0">
            <h1
              className={`${DISPLAY} text-3xl font-bold text-[#7a3d2c] sm:text-4xl dark:text-[#ffe6c4]`}
            >
              What&apos;s new
            </h1>
            <p className="text-base font-bold text-[#7a5a78] dark:text-[#c9a9d6]">
              You&apos;re on v{FLAMELINGS_VERSION}
            </p>
          </div>
        </header>
        <main className="space-y-5 py-5">
          {CHANGELOG.map((release) => (
            <article
              key={release.version}
              aria-labelledby={`release-${release.version}`}
              className={`${STICKER} p-5`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2
                  id={`release-${release.version}`}
                  className={`${DISPLAY} text-xl font-semibold`}
                >
                  <span className="mr-1 rounded-full bg-gradient-to-b from-[#ffe58a] to-[#ffc53d] px-3 py-0.5 text-[#7a3d00] shadow-[0_2px_0_#d9952a]">
                    v{release.version}
                  </span>{" "}
                  {release.title}
                </h2>
                <time
                  dateTime={release.date}
                  className="text-sm font-bold text-[#7a5a78]"
                >
                  {formatDate(release.date)}
                </time>
              </div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base text-[#3a2340] marker:text-[#f2542d]">
                {release.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </article>
          ))}
        </main>
      </div>
    </div>
  );
}

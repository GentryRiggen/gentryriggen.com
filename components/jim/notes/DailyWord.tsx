import type { DailyWord as DailyWordData } from "@/lib/jim/view";

/** Today's word: a quiet card under the date. Plain text only. */
export default function DailyWord({ word }: { word: DailyWordData }) {
  return (
    <article className="jim-card relative overflow-hidden py-4 pr-4 pl-5">
      <span
        aria-hidden="true"
        className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-ayu-accent to-ayu-orange"
      />
      <p className="text-xs font-semibold tracking-[0.14em] text-ayu-accent uppercase">
        {word.kind}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-ayu-text [overflow-wrap:anywhere]">
        {word.title}
      </h2>
      <p className="mt-1.5 text-ayu-text [overflow-wrap:anywhere]">
        {word.text}
      </p>
      {word.source && (
        <p className="mt-1 text-sm text-ayu-subtle [overflow-wrap:anywhere]">
          {word.source}
        </p>
      )}
      {word.apply && (
        <p className="mt-2 text-sm text-ayu-text [overflow-wrap:anywhere]">
          <span className="font-medium text-ayu-accent">Try: </span>
          {word.apply}
        </p>
      )}
    </article>
  );
}

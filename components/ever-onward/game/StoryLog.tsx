import type { RunState, UniverseDef } from "@/lib/ever-onward/engine/types";

interface StoryLogProps {
  def: UniverseDef;
  run: RunState;
}

const VISIBLE = 5;
const NEWS_PREFIX = "NEWS:";
const FADE = [
  "text-base text-slate-900 dark:text-slate-50",
  "text-sm text-slate-700 dark:text-slate-300",
  "text-sm text-slate-600 dark:text-slate-400",
  "text-sm text-slate-500 dark:text-slate-500",
  "text-sm text-slate-400 dark:text-slate-600",
];

export default function StoryLog({ def, run }: StoryLogProps) {
  const texts = new Map(def.story.map((m) => [m.id, m.text]));
  const latest = run.story
    .slice(-VISIBLE)
    .reverse()
    .flatMap((id) => {
      const text = texts.get(id);
      return text ? [{ id, text }] : [];
    });
  if (latest.length === 0) return null;
  return (
    <section
      aria-label="Story"
      className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Announces only the newest line, not the whole list each time. */}
      <p aria-live="polite" className="sr-only">
        {latest[0].text.replace(NEWS_PREFIX, "News:")}
      </p>
      {latest.map((m, i) => {
        const isNews = m.text.startsWith(NEWS_PREFIX);
        return (
          <p key={m.id} className={`${i === 0 ? "lm-fade-up" : ""} ${FADE[i]}`}>
            {isNews && (
              <span className="mr-2 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold tracking-wide text-white">
                NEWS
              </span>
            )}
            {isNews ? m.text.slice(NEWS_PREFIX.length).trim() : m.text}
          </p>
        );
      })}
    </section>
  );
}

import { ChevronLeft } from "lucide-react";
import { Chip, Empty } from "@/components/jim/notes/NotesUi";
import JimMarkdown from "@/lib/jim/markdown";
import { personFacts } from "@/lib/jim/notesData";
import { fmtShort, stripMd } from "@/lib/jim/todos";
import type { Person } from "@/lib/jim/view";

interface NotesPersonProps {
  person: Person;
  today: string;
  onBack: () => void;
  /** Where the back button goes ("People", or "Results" from a search). */
  backLabel?: string;
}

/** One person's profile: key facts, strengths, then their whole note. */
export default function NotesPerson({
  person,
  today,
  onBack,
  backLabel = "People",
}: NotesPersonProps) {
  const facts = personFacts(person, today);
  const strengths = Array.isArray(person.strengths) ? person.strengths : [];
  const body = typeof person.body === "string" ? person.body.trim() : "";
  const updated =
    typeof person.updated === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(person.updated)
      ? `${fmtShort(person.updated)}, ${person.updated.slice(0, 4)}`
      : null;

  return (
    <article className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex min-h-11 items-center gap-1 rounded-md pr-3 pl-1 text-ayu-accent hover:bg-white/[0.06]"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
        {backLabel}
      </button>
      <header className="space-y-1">
        <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ayu-text [overflow-wrap:anywhere]">
          {person.name}
        </h2>
        {person.about && (
          <p className="text-ayu-subtle [overflow-wrap:anywhere]">
            {stripMd(person.about)}
          </p>
        )}
      </header>
      {facts.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 jim-card px-4 py-3.5">
          {facts.map(([label, value]) =>
            label ? (
              <div key={label} className="contents">
                <dt className="text-sm text-ayu-subtle">{label}</dt>
                <dd className="text-ayu-text">{value}</dd>
              </div>
            ) : (
              <dd key={value} className="col-span-2 text-ayu-text">
                {value}
              </dd>
            )
          )}
        </dl>
      )}
      {strengths.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm text-ayu-subtle">CliftonStrengths</p>
          <div className="flex flex-wrap gap-1.5">
            {strengths.map((s) => (
              <Chip key={s} tone="purple">
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="border-t border-white/[0.06] pt-5 text-ayu-text">
        {body ? (
          <JimMarkdown text={body} links="label" />
        ) : (
          <Empty>Nothing else saved yet.</Empty>
        )}
      </div>
      {updated && <p className="text-sm text-ayu-subtle">Updated {updated}</p>}
    </article>
  );
}

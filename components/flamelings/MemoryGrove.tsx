import { useFlamelings } from "@/lib/flamelings/store";
import { FORM_INFO } from "@/lib/flamelings/forms";
import { stageTitle } from "@/lib/flamelings/status";
import Blob from "./Blob";
import { BIG_BUTTON, SAFE_BOTTOM, SAFE_SIDES, SAFE_TOP } from "./styles";

/** Where flamelings that went out for good are remembered. */
export default function MemoryGrove() {
  const memorial = useFlamelings((s) => s.save.memorial);
  const go = useFlamelings((s) => s.go);
  return (
    <div
      className={`flex h-full flex-col overflow-y-auto overflow-x-hidden bg-gradient-to-b from-emerald-950 via-teal-950 to-slate-950 text-emerald-50 ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <header className="flex items-center justify-between gap-3 py-2">
        <h1 className="text-3xl font-black">
          <span aria-hidden="true">🕯️ </span>Memory Grove
        </h1>
        <button
          type="button"
          onClick={() => go({ screen: "shelf" })}
          aria-label="Back to the shelf"
          className={`${BIG_BUTTON} bg-emerald-100 px-5 text-2xl text-emerald-950`}
        >
          <span aria-hidden="true">🏠</span>
        </button>
      </header>
      <p className="py-2 text-lg font-semibold opacity-80">
        These flamelings went out, but everything they unlocked is still yours.
      </p>
      <ul className="grid gap-4 py-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
        {memorial.map((m) => (
          <li
            key={m.id}
            data-testid="grave"
            className="relative flex flex-col items-center gap-1 overflow-hidden rounded-3xl border border-amber-700/50 bg-stone-900 p-4 text-amber-50 shadow-lg shadow-black/40"
          >
            <span
              aria-hidden="true"
              className="fl-candle-glow pointer-events-none absolute -top-8 left-1/2 size-44 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,190,90,0.55),rgba(255,150,40,0)_70%)]"
            />
            <span aria-hidden="true" className="relative text-3xl">
              🕯️
            </span>
            <Blob
              look={m.look}
              worn={m.worn}
              form={m.form}
              mood="ember"
              className="size-40"
            />
            <span className="relative text-xl font-extrabold text-amber-50">
              {m.name}
            </span>
            <span className="relative text-sm font-semibold text-amber-200">
              Level {m.level} · {m.daysLived}{" "}
              {m.daysLived === 1 ? "day" : "days"}
            </span>
            {m.form && (
              <span
                data-testid="grave-form"
                className="relative rounded-full bg-amber-100/15 px-3 py-0.5 text-sm font-bold text-amber-100"
              >
                <span aria-hidden="true">{FORM_INFO[m.form].glyph} </span>
                {stageTitle(m.level, m.form)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

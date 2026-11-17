import { useFlamelings } from "@/lib/flamelings/store";
import Blob from "./Blob";
import {
  BIG_BUTTON,
  CARD,
  FOCUS_RING,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
} from "./styles";

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
            className={`${CARD} flex flex-col items-center gap-1 bg-emerald-900/50 p-4 text-emerald-50 dark:bg-emerald-900/50 ${FOCUS_RING}`}
          >
            <span aria-hidden="true" className="text-3xl">
              🕯️
            </span>
            <Blob
              look={m.look}
              worn={m.worn}
              mood="ember"
              className="size-28"
            />
            <span className="text-xl font-extrabold">{m.name}</span>
            <span className="text-sm font-semibold opacity-80">
              Level {m.level} · {m.daysLived}{" "}
              {m.daysLived === 1 ? "day" : "days"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

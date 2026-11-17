import Link from "next/link";
import { MAX_PETS } from "@/lib/flamelings/actions";
import { stageFor } from "@/lib/flamelings/progress";
import { moodOf } from "@/lib/flamelings/sim";
import { stateGlyph } from "@/lib/flamelings/status";
import { useFlamelings } from "@/lib/flamelings/store";
import { FLAMELINGS_VERSION } from "@/lib/flamelings/version";
import type { Pet } from "@/lib/flamelings/types";
import Blob from "./Blob";
import EggArt from "./EggArt";
import {
  BIG_BUTTON,
  CARD,
  CHROME_BG,
  FOCUS_RING,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
} from "./styles";

function PetCard({ pet, nowMs }: { pet: Pet; nowMs: number }) {
  const go = useFlamelings((s) => s.go);
  const glyph = stateGlyph(pet, nowMs);
  const stage = stageFor(pet.level);
  return (
    <button
      type="button"
      onClick={() => go({ screen: "pet", petId: pet.id })}
      aria-label={`${pet.name}, level ${pet.level} ${stage.name}${glyph ? `, ${glyph.label}` : ""}`}
      data-testid="pet-card"
      className={`${CARD} relative flex flex-col items-center gap-1 p-4 pb-3 transition-transform active:scale-95 ${FOCUS_RING}`}
    >
      {glyph && (
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-white text-2xl shadow dark:bg-slate-700"
        >
          {glyph.glyph}
        </span>
      )}
      <Blob
        look={pet.look}
        worn={pet.worn}
        mood={moodOf(pet, nowMs)}
        stage={stage.id}
        className="size-40 sm:size-48"
      />
      <span className="max-w-full truncate text-xl font-extrabold">
        {pet.name}
      </span>
      <span className="text-sm font-semibold text-stone-600 dark:text-amber-200/80">
        Lv {pet.level} · {stage.name}
      </span>
    </button>
  );
}

/** The landing screen: every pet on a shelf, a place to hatch more. */
export default function Shelf() {
  const save = useFlamelings((s) => s.save);
  const clock = useFlamelings((s) => s.clock);
  const go = useFlamelings((s) => s.go);
  const canHatch = save.pets.length < MAX_PETS;
  return (
    <div
      className={`flex h-full flex-col overflow-y-auto overflow-x-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <header className="flex items-center justify-between gap-3 py-2">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          <span aria-hidden="true">🔥 </span>Flamelings
        </h1>
        {save.memorial.length > 0 && (
          <button
            type="button"
            onClick={() => go({ screen: "grove" })}
            className={`${BIG_BUTTON} bg-emerald-700 px-5 text-lg text-white dark:bg-emerald-300 dark:text-emerald-950`}
          >
            <span aria-hidden="true">🕯️ </span>Memory Grove
          </button>
        )}
      </header>
      <main className="grid flex-1 content-start gap-4 py-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
        {save.pets.map((pet) => (
          <PetCard key={pet.id} pet={pet} nowMs={clock} />
        ))}
        {canHatch && (
          <button
            type="button"
            onClick={() => go({ screen: "hatch" })}
            data-testid="hatch-new"
            className={`${CARD} flex min-h-52 flex-col items-center justify-center gap-2 border-4 border-dashed border-orange-400 p-4 transition-transform active:scale-95 dark:border-orange-300 ${FOCUS_RING}`}
          >
            <EggArt taps={0} hit={0} className="size-28" />
            <span className="text-xl font-extrabold">Hatch new</span>
          </button>
        )}
      </main>
      <footer className="flex justify-center py-3 text-sm">
        <Link
          href="/flamelings/versions"
          className={`rounded-full px-4 py-2 font-semibold text-stone-600 underline dark:text-amber-200/80 ${FOCUS_RING}`}
        >
          What&apos;s new · v{FLAMELINGS_VERSION}
        </Link>
      </footer>
    </div>
  );
}

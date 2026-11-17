import { useFlamelings } from "@/lib/flamelings/store";
import { FORM_INFO } from "@/lib/flamelings/forms";
import { stageTitle } from "@/lib/flamelings/status";
import Blob from "./Blob";
import FlIcon from "./FlIcon";
import PanelHeader from "./PanelHeader";
import {
  CHROME_BG,
  DISPLAY,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  STICKER_BUTTON,
} from "./styles";

/** Where flamelings that went out for good are remembered. */
export default function MemoryGrove() {
  const memorial = useFlamelings((s) => s.save.memorial);
  const go = useFlamelings((s) => s.go);
  return (
    <div
      className={`fl-sheet-up flex h-full flex-col overflow-y-auto overflow-x-hidden ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div className="mx-auto w-full max-w-5xl">
        <PanelHeader icon="glade" title="Memory Grove" level={1}>
          <button
            type="button"
            onClick={() => go({ screen: "shelf" })}
            aria-label="Back to the shelf"
            className={`${STICKER_BUTTON} size-16`}
          >
            <FlIcon name="home" className="size-8" />
          </button>
        </PanelHeader>
        <p className="py-2 text-lg font-semibold text-[#7a5a78] dark:text-[#c9a9d6]">
          These flamelings went out, but everything they unlocked is still
          yours.
        </p>
        <ul className="grid gap-4 py-3 [grid-template-columns:repeat(auto-fill,minmax(11rem,1fr))]">
          {memorial.map((m) => (
            <li
              key={m.id}
              data-testid="grave"
              className="fl-pop-in relative flex flex-col items-center gap-1 overflow-hidden rounded-[30px] border-2 border-[rgba(255,230,200,.25)] bg-[linear-gradient(180deg,#3b2a5c,#221836)] p-4 text-[#ffe6c4] shadow-[inset_0_0_50px_rgba(255,150,60,.12),0_5px_0_#160f28,0_12px_24px_rgba(30,10,40,.3)]"
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
              <span
                className={`${DISPLAY} relative text-2xl font-semibold text-[#fff6e6]`}
              >
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
    </div>
  );
}

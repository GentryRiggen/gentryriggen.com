import { useFlamelings } from "@/lib/flamelings/store";
import FlIcon from "./FlIcon";
import {
  CHROME_BG,
  DISPLAY,
  PRIMARY_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
  STICKER,
} from "./styles";

/** Shown when another tab is playing, so two tabs never save over each other. */
export default function TabLocked() {
  const takeOver = useFlamelings((s) => s.takeOver);
  return (
    <div
      role="alert"
      data-testid="tab-locked"
      className={`flex h-full flex-col items-center justify-center ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <div
        className={`${STICKER} fl-pop-in flex w-full max-w-md flex-col items-center gap-5 p-7 text-center`}
      >
        <span
          aria-hidden="true"
          className="grid size-24 place-items-center rounded-full bg-[radial-gradient(circle,#ffe2b0_0%,rgba(255,226,176,0)_70%)]"
        >
          <FlIcon name="fuel" className="size-16" />
        </span>
        <h1 className={`${DISPLAY} text-3xl font-bold text-[#7a3d2c]`}>
          Flamelings is open in another tab
        </h1>
        <p className="text-lg font-semibold text-[#7a5a78]">
          Only one tab can look after your flamelings at a time, so nothing gets
          mixed up.
        </p>
        <button type="button" onClick={takeOver} className={PRIMARY_BUTTON}>
          Play here
        </button>
      </div>
    </div>
  );
}

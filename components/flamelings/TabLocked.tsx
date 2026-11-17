import { useFlamelings } from "@/lib/flamelings/store";
import {
  CHROME_BG,
  PRIMARY_BUTTON,
  SAFE_BOTTOM,
  SAFE_SIDES,
  SAFE_TOP,
} from "./styles";

/** Shown when another tab is playing, so two tabs never save over each other. */
export default function TabLocked() {
  const takeOver = useFlamelings((s) => s.takeOver);
  return (
    <div
      role="alert"
      data-testid="tab-locked"
      className={`flex h-full flex-col items-center justify-center gap-6 text-center ${CHROME_BG} ${SAFE_TOP} ${SAFE_BOTTOM} ${SAFE_SIDES}`}
    >
      <span aria-hidden="true" className="text-7xl">
        🔥
      </span>
      <h1 className="text-3xl font-black">Flamelings is open in another tab</h1>
      <p className="max-w-md text-lg font-semibold opacity-80">
        Only one tab can look after your flamelings at a time, so nothing gets
        mixed up.
      </p>
      <button type="button" onClick={takeOver} className={PRIMARY_BUTTON}>
        Play here
      </button>
    </div>
  );
}

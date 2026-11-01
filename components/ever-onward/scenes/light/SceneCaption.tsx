import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { pixelClass } from "../../game/retro/retroStyles";

const num = (n: number): string => Math.floor(n).toLocaleString("en-US");

/** The one line that says what the picture is showing, with live counts. */
export function captionFor(info: LightSceneInfo): string {
  switch (info.phase) {
    case "coast":
      return `Ships guided: ${num(info.ships)} · Lights ${info.lighthouses}/8`;
    case "night":
      return `Cities lit: ${num(info.cities)}/100 · Grid ${Math.round(
        info.gridSteadiness * 100
      )}%`;
    case "sky":
      return `Collectors ${info.collectors}/6 · Stars left ${num(
        info.starsRemaining
      )}`;
    default:
      return `Lights still burning: ${num(info.lightsRemaining)}`;
  }
}

/** A dark strip at the bottom-left of the scene. Same facts are in the page text. */
export default function SceneCaption({ info }: { info: LightSceneInfo }) {
  return (
    <p
      aria-hidden="true"
      data-testid="lm-scene-caption"
      className={`${pixelClass} pointer-events-none absolute bottom-0 left-0 max-w-full truncate bg-black/65 px-2 py-1.5 text-[9px] leading-none text-amber-100 sm:text-[10px] lg:text-xs`}
    >
      {captionFor(info)}
    </p>
  );
}

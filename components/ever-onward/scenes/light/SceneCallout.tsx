import { useEffect, useState } from "react";
import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import { pixelClass } from "../../game/retro/retroStyles";
import { calloutFor } from "./callouts";
import type { LastBuy } from "../../universes/types";

const FONT_SIZE = 9;
/** How long the label stays before it is taken out of the picture. */
const SHOW_MS = 1800;

interface SceneCalloutProps {
  buy: LastBuy;
  info: LightSceneInfo;
}

/**
 * A short label and a ring where a purchase landed. It sits in its own group
 * on top of the layers, so showing it never redraws them. The spot is worked
 * out once, when the purchase arrives.
 */
export default function SceneCallout({ buy, info }: SceneCalloutProps) {
  const [callout] = useState(() => calloutFor(buy, info));
  const [isShown, setIsShown] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsShown(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!callout || !isShown) return null;
  const width = callout.text.length * FONT_SIZE + 10;
  const textX = Math.min(396 - width / 2, Math.max(4 + width / 2, callout.x));
  const textY = Math.max(56, callout.y - 16);

  return (
    <g
      aria-hidden="true"
      data-testid="lm-callout"
      className="pointer-events-none"
    >
      <circle
        cx={callout.x}
        cy={callout.y}
        r="14"
        fill="#ffe08a"
        fillOpacity="0.18"
        stroke="#ffe08a"
        strokeWidth="2"
        className="lm-ring"
      />
      <g transform={`translate(${textX} ${textY})`}>
        <g className="lm-callout">
          <rect
            x={-width / 2}
            y={-FONT_SIZE - 3}
            width={width}
            height={FONT_SIZE + 8}
            fill="#02030a"
            fillOpacity="0.82"
            stroke="#ffe08a"
            strokeWidth="1"
          />
          <text
            textAnchor="middle"
            fontSize={FONT_SIZE}
            fill="#ffe9a0"
            className={pixelClass}
          >
            {callout.text}
          </text>
        </g>
      </g>
    </g>
  );
}

export type PixelIconName = "lantern" | "bolt" | "sun" | "flame";

interface IconArt {
  rows: readonly string[];
  palette: Readonly<Record<string, string>>;
}

/** Tiny sprites, one letter per pixel; "." is empty. */
const ART: Record<PixelIconName, IconArt> = {
  lantern: {
    rows: [
      "...HHH...",
      "..H...H..",
      "..CCCCC..",
      ".XXXXXXX.",
      ".XYYYYYX.",
      ".XYWWWYX.",
      ".XYWWWYX.",
      ".XYYYYYX.",
      ".XXXXXXX.",
      "..CCCCC..",
    ],
    palette: {
      H: "#fcd34d",
      C: "#b45309",
      X: "#78350f",
      Y: "#fbbf24",
      W: "#fff7ed",
    },
  },
  bolt: {
    rows: [
      "....XXX.",
      "...XYY..",
      "..XYY...",
      ".XYYYYY.",
      "...XYY..",
      "..XYY...",
      ".XYX....",
      ".XX.....",
    ],
    palette: { X: "#3f6212", Y: "#d9f99d" },
  },
  sun: {
    rows: [
      "....Y....",
      ".Y..Y..Y.",
      "..XXXXX..",
      "..XWWWX..",
      "YYXWWWXYY",
      "..XWWWX..",
      "..XXXXX..",
      ".Y..Y..Y.",
      "....Y....",
    ],
    palette: { Y: "#fdba74", X: "#c2410c", W: "#fff7ed" },
  },
  flame: {
    rows: [
      "...X...",
      "..XX...",
      "..XYX..",
      ".XYYYX.",
      ".XYWYX.",
      "XYYWWYX",
      "XYWWWYX",
      ".XYYYX.",
      "..XXX..",
    ],
    palette: { X: "#9f1239", Y: "#fb7185", W: "#ffe4e6" },
  },
};

interface PixelIconProps {
  name: PixelIconName;
  className?: string;
}

/** A decorative pixel-art icon, drawn as crisp squares. */
export default function PixelIcon({ name, className = "" }: PixelIconProps) {
  const { rows, palette } = ART[name];
  const width = rows[0].length;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${rows.length}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {rows.flatMap((row, y) =>
        [...row].map((char, x) =>
          char === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={palette[char]}
            />
          )
        )
      )}
    </svg>
  );
}

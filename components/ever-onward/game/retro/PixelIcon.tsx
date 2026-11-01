export type PixelIconName =
  "lantern" | "bolt" | "sun" | "flame" | "can" | "wheat" | "sapling" | "pot";

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
  can: {
    rows: [
      "..........",
      "......XXX.",
      ".X...X...X",
      ".XX.XXXXX.",
      "..XXYYYYXX",
      "..XYYYYYX.",
      "..XYYWYYX.",
      "..XYYYYYX.",
      "...XXXXX..",
    ],
    palette: { X: "#075985", Y: "#7dd3fc", W: "#f0f9ff" },
  },
  wheat: {
    rows: [
      "...Y.Y...",
      "..YY.YY..",
      "..YY.YY..",
      "...YXY...",
      "..YY.YY..",
      "..YYXYY..",
      "...YXY...",
      "....X....",
      "....X....",
    ],
    palette: { X: "#4d7c0f", Y: "#fde047" },
  },
  sapling: {
    rows: [
      "..XX..XX.",
      ".XYYX.XYX",
      ".XYYYXYYX",
      "..XYYYYX.",
      "...XYYX..",
      "....SX...",
      "....S....",
      ".DDDSDDD.",
      "DDDDDDDDD",
    ],
    palette: { X: "#166534", Y: "#86efac", S: "#92400e", D: "#78350f" },
  },
  pot: {
    rows: [
      "...X.X...",
      "..XYXYX..",
      "...XYX...",
      "....X....",
      "CCCCCCCCC",
      ".RRRRRRR.",
      ".RTTTTTR.",
      "..RRRRR..",
      "..RRRRR..",
    ],
    palette: {
      X: "#166534",
      Y: "#86efac",
      C: "#fdba74",
      R: "#c2410c",
      T: "#7c2d12",
    },
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

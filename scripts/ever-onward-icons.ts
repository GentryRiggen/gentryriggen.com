/**
 * Renders the Ever Onward home-screen icons: the robot with its lantern on a
 * dark night sky, in the look of a season, written to
 * public/ever-onward-icons/ (PNGs and icon.svg).
 *
 * Usage: npx tsx scripts/ever-onward-icons.ts [--season default|autumn|winter|spring|summer]
 * Without --season it renders the evergreen default: iOS freezes a home-screen
 * icon at install, so the shipped icons carry no seasonal accessory.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  DEFAULT_SEASON,
  seasonById,
  type Season,
} from "../lib/ever-onward/season";
import {
  EYE_COLOR,
  LANTERN_CENTER,
  ROBOT_COLORS,
  ROBOT_EYES,
  ROBOT_HEIGHT,
  ROBOT_ROWS,
  spriteRects,
} from "../lib/ever-onward/start/sprites";

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/ever-onward-icons"
);

const ICONS = [
  { file: "apple-touch-icon.png", size: 180, padding: 0.05 },
  { file: "icon-192.png", size: 192, padding: 0.05 },
  { file: "icon-512.png", size: 512, padding: 0.05 },
  // Maskable icons may be cropped to a circle: keep the art in the central 60%.
  { file: "icon-512-maskable.png", size: 512, padding: 0.2 },
];

function pickSeason(): Season {
  const flag = process.argv.indexOf("--season");
  if (flag === -1) return DEFAULT_SEASON;
  const season = seasonById(process.argv[flag + 1]);
  if (!season) {
    throw new Error(
      `Unknown season "${process.argv[flag + 1]}". Try autumn, winter, spring, summer or default.`
    );
  }
  return season;
}

const rect = (r: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}) =>
  `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.fill}" />`;

/** Robot columns that hold art (the left arm to the lantern's edge). */
const ART_LEFT = 3;
const ART_RIGHT = 20;
/** Extra columns kept for the lantern's glow so it is never cut off. */
const GLOW_MARGIN = 2.5;

/**
 * The icon as an SVG on a 100 x 100 canvas. `padding` is the fraction left
 * empty on each side; the sky fills the whole square. The robot, lantern and
 * its glow are centred and fitted inside the padded area.
 */
function iconSvg(season: Season, padding: number): string {
  // Rows an accessory (a hat, a sprout) reaches above the robot's head.
  const above = Math.max(0, ...season.accessories.map((a) => -a.y));
  const cols = ART_RIGHT + GLOW_MARGIN - ART_LEFT;
  const rows = ROBOT_HEIGHT + above;
  const unit = (100 * (1 - 2 * padding)) / Math.max(cols, rows);
  const left = 50 - unit * (cols / 2 + ART_LEFT);
  const top = 50 - (rows * unit) / 2 + above * unit;
  const palette = { ...ROBOT_COLORS, L: season.lantern };
  const lanternX = left + LANTERN_CENTER.x * unit;
  const lanternY = top + LANTERN_CENTER.y * unit;

  const body = spriteRects(ROBOT_ROWS, palette).map(rect);
  const eyes = ROBOT_EYES.map((eye) => rect({ ...eye, fill: EYE_COLOR }));
  const accessories = season.accessories.flatMap((a) =>
    spriteRects(a.rows, a.colors, a.x, a.y).map(rect)
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" shape-rendering="crispEdges">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#02030a" />
      <stop offset="1" stop-color="#1b1236" />
    </linearGradient>
    <radialGradient id="glow">
      <stop offset="0" stop-color="${season.lantern}" stop-opacity="0.95" />
      <stop offset="1" stop-color="${season.lantern}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="beam" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${season.beam}" stop-opacity="0.5" />
      <stop offset="1" stop-color="${season.beam}" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#sky)" />
  <polygon points="${lanternX},${lanternY} 140,${lanternY - 30} 140,${lanternY + 20}" fill="url(#beam)" />
  <circle cx="${lanternX}" cy="${lanternY}" r="${unit * 3.5}" fill="url(#glow)" />
  <g transform="translate(${left} ${top}) scale(${unit})">
    ${body.join("\n    ")}
    ${eyes.join("\n    ")}
    ${accessories.join("\n    ")}
  </g>
</svg>`;
}

async function main() {
  const season = pickSeason();
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "icon.svg"), iconSvg(season, 0.05));
  for (const { file, size, padding } of ICONS) {
    const svg = iconSvg(season, padding);
    // Render large, then shrink with nearest-neighbour so pixels stay sharp.
    await sharp(Buffer.from(svg), { density: 72 * (size / 100) * 2 })
      .resize(size, size, { kernel: "nearest" })
      .png()
      .toFile(path.join(OUT_DIR, file));
  }
  console.log(`Wrote the ${season.label} icons to ${OUT_DIR}`);
}

void main();

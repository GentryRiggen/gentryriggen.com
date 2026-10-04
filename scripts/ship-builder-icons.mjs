/**
 * Renders the Ship Builder home-screen icons.
 *
 * Draws a procedural Titanic-era liner (black hull, red boot-top, white
 * superstructure, two buff funnels with black tops) on sea blue, then
 * rasterises it with sharp into public/ship-builder-icons/.
 *
 * Usage: node scripts/ship-builder-icons.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SEA_BLUE = "#1f4e6e";
const DEEP_WATER = "#163a52";
const HULL_BLACK = "#111111";
const BOOT_TOP_RED = "#b3261e";
const SUPERSTRUCTURE_WHITE = "#f5f3ee";
const FUNNEL_BUFF = "#d8a85a";

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/ship-builder-icons"
);

const ICONS = [
  { file: "apple-touch-icon.png", size: 180, padding: 0.1 },
  { file: "icon-192.png", size: 192, padding: 0.1 },
  { file: "icon-512.png", size: 512, padding: 0.1 },
  // Maskable icons may be cropped to a circle: keep the ship inside the
  // central 60% (20% safe padding on every side).
  { file: "icon-512-maskable.png", size: 512, padding: 0.2 },
];

/** A funnel raked aft (towards -x) with a black cap, in 0–100 units. */
function funnel(x, width) {
  const base = 42;
  const top = 22;
  const rake = 3;
  const capDepth = 4;
  const capRake = (rake * capDepth) / (base - top);
  const capLeft = x - rake + capRake;
  return `
    <polygon fill="${FUNNEL_BUFF}"
      points="${x},${base} ${x + width},${base} ${x + width - rake},${top} ${x - rake},${top}" />
    <polygon fill="${HULL_BLACK}"
      points="${capLeft},${top + capDepth} ${capLeft + width},${top + capDepth} ${x + width - rake},${top} ${x - rake},${top}" />`;
}

/**
 * The liner, drawn in a 100×100 content box with the bow to the right. The
 * water is drawn last so it covers the bottom of the boot-top.
 */
function linerSvg() {
  return `
    <line x1="17" y1="54" x2="15" y2="26" stroke="${SUPERSTRUCTURE_WHITE}" stroke-width="0.9" />
    <line x1="85" y1="52" x2="83" y2="27" stroke="${SUPERSTRUCTURE_WHITE}" stroke-width="0.9" />
    <rect x="24" y="46" width="50" height="8.5" fill="${SUPERSTRUCTURE_WHITE}" />
    <rect x="31" y="41" width="37" height="5.5" fill="${SUPERSTRUCTURE_WHITE}" />
    ${funnel(41, 7)}
    ${funnel(56, 7)}
    <path fill="${HULL_BLACK}" d="M6 53 L94 50 L88 66 L12 66 Q8 61 6 53 Z" />
    <path fill="${BOOT_TOP_RED}" d="M12 66 L88 66 L86 72 L16 72 Q13.5 69 12 66 Z" />
    <rect x="-200" y="69.5" width="500" height="300" fill="${DEEP_WATER}" />`;
}

function iconSvg(size, padding) {
  const scale = (size * (1 - 2 * padding)) / 100;
  const offset = size * padding;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${SEA_BLUE}" />
  <g transform="translate(${offset} ${offset}) scale(${scale}) translate(0 5)">${linerSvg()}</g>
</svg>`;
}

await mkdir(OUT_DIR, { recursive: true });
for (const { file, size, padding } of ICONS) {
  await sharp(Buffer.from(iconSvg(size, padding)))
    .png()
    .toFile(path.join(OUT_DIR, file));
  console.log(`wrote ${file} (${size}x${size})`);
}

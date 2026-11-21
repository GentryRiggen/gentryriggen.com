/**
 * Renders the Shipwreck home-screen icons: a four-funnel liner tilted
 * bow-down into a glassy night sea, rasterised with sharp into
 * public/shipwreck-icons/.
 *
 * File names carry a version (gameIconPaths in lib/game-kit/metadata.ts): iOS keeps
 * an icon by URL, so a changed icon needs a new name AND the page's
 * `iconVersion` bumped.
 *
 * Usage: node scripts/shipwreck-icons.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/shipwreck-icons"
);

const STARS = [
  [8, 8, 0.7],
  [17, 22, 0.5],
  [26, 6, 0.9],
  [38, 15, 0.5],
  [47, 4, 0.6],
  [58, 11, 0.8],
  [69, 5, 0.5],
  [79, 14, 0.9],
  [91, 7, 0.6],
  [86, 26, 0.5],
  [70, 24, 0.4],
  [5, 30, 0.5],
  [33, 28, 0.4],
  [95, 36, 0.4],
]
  .map(
    ([x, y, r]) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#eef4ff" opacity="0.9" />`
  )
  .join("");

/** Two rows of lit portholes along the hull and one along the white decks. */
const PORTHOLES = [
  ...Array.from({ length: 23 }, (_, i) => [14 + i * 3.3, 53.6]),
  ...Array.from({ length: 22 }, (_, i) => [16 + i * 3.3, 57]),
  ...Array.from({ length: 17 }, (_, i) => [24 + i * 3.3, 47]),
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.75" fill="#ffd27f" />`)
  .join("");

/** Four buff funnels raked aft, with black tops. */
const FUNNELS = [33, 44, 55, 66]
  .map(
    (x) =>
      `<path d="M${x} 41 L${x + 5.6} 41 L${x + 4.2} 23 L${x - 1.4} 23 Z" fill="#d89a3c" />` +
      `<path d="M${x - 1.08} 27 L${x + 4.52} 27 L${x + 4.2} 23 L${x - 1.4} 23 Z" fill="#14100b" />`
  )
  .join("");

/**
 * The scene in a 100x100 box: a starlit, moonless night and the four-funnel
 * liner going down bow-first, her stern and red hull lifting clear while the
 * glassy sea closes over her bow and mirrors her lights.
 */
const SCENE = `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#01030a" />
      <stop offset="0.75" stop-color="#0a1630" />
      <stop offset="1" stop-color="#1a2f55" />
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#10284a" stop-opacity="0.88" />
      <stop offset="1" stop-color="#020812" stop-opacity="1" />
    </linearGradient>
    <linearGradient id="streak" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd27f" stop-opacity="0.75" />
      <stop offset="1" stop-color="#ffd27f" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#sky)" />
  <ellipse cx="50" cy="20" rx="70" ry="7" transform="rotate(-24 50 20)" fill="#9fb6e0" opacity="0.05" />
  ${STARS}
  <g transform="translate(5 5) scale(0.92)"><g transform="rotate(16 45 60)">
    <rect x="21.6" y="21" width="0.8" height="23" fill="#0b0e15" />
    <rect x="79.6" y="22" width="0.8" height="22" fill="#0b0e15" />
    <path d="M22 22 L80 23" stroke="#3a4558" stroke-width="0.3" />
    ${FUNNELS}
    <rect x="22" y="44" width="58" height="6.2" fill="#e8e4d8" />
    <rect x="28" y="40.6" width="46" height="3.6" fill="#f3f0e7" />
    <path d="M8 50 L90 50 L95 48.6 L88.5 66 L17 66 L10.5 60 Z" fill="#0b0e15" />
    <path d="M12.6 62.2 L89.3 62.2 L88.5 66 L17 66 Z" fill="#9a2219" />
    <path d="M8.4 50.8 L91.5 50.8" stroke="#c9a55a" stroke-width="0.35" />
    ${PORTHOLES}
  </g></g>
  <rect y="60" width="100" height="40" fill="url(#sea)" />
  <path d="M0 60 H100" stroke="#6f93c4" stroke-width="0.4" opacity="0.7" />
  <g fill="url(#streak)" opacity="0.8">
    <rect x="18" y="61" width="1.2" height="18" />
    <rect x="26" y="61" width="1.4" height="24" />
    <rect x="34" y="61" width="1.2" height="20" />
    <rect x="42" y="61" width="1.5" height="27" />
    <rect x="50" y="61" width="1.2" height="21" />
    <rect x="58" y="61" width="1.4" height="25" />
    <rect x="66" y="61" width="1" height="15" />
  </g>
  <g stroke="#7fa3d0" stroke-width="0.3" opacity="0.35">
    <path d="M6 70 H22 M70 72 H94 M10 86 H30 M64 90 H88" />
  </g>
`;

/** `scale` is how much of the tile the 100 box fills. */
function tile(size, scale) {
  const inner = size * scale;
  const offset = (size - inner) / 2;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#05080f" />
      <svg x="${offset}" y="${offset}" width="${inner}" height="${inner}" viewBox="0 0 100 100">${SCENE}</svg>
    </svg>`);
}

const ICONS = [
  { file: "apple-touch-icon-v1.png", size: 180, scale: 1.0 },
  { file: "icon-192-v1.png", size: 192, scale: 1.0 },
  { file: "icon-512-v1.png", size: 512, scale: 1.0 },
  { file: "icon-512-maskable-v1.png", size: 512, scale: 0.78 },
];

await mkdir(OUT_DIR, { recursive: true });
for (const { file, size, scale } of ICONS) {
  await sharp(tile(size, scale), { density: 144 })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT_DIR, file));
  console.log(`wrote ${file}`);
}

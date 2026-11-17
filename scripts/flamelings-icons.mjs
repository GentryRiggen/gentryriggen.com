/**
 * Renders the Flamelings home-screen icons: the ember blob on a night-purple
 * tile, rasterised with sharp into public/flamelings-icons/.
 *
 * Usage: node scripts/flamelings-icons.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/flamelings-icons"
);

/** The blob at rest, in the 120x120 box, with its goo filter and gradient. */
const BLOB = `
  <defs>
    <filter id="goo" x="-30%" y="-40%" width="160%" height="170%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
      <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
    </filter>
    <linearGradient id="fill" gradientUnits="userSpaceOnUse" x1="0" y1="108" x2="0" y2="38">
      <stop offset="0" stop-color="#f9531c" />
      <stop offset="0.55" stop-color="#ff9a1f" />
      <stop offset="1" stop-color="#ffd84a" />
    </linearGradient>
  </defs>
  <g filter="url(#goo)" fill="url(#fill)">
    <circle cx="60" cy="78" r="30" />
    <circle cx="42" cy="70" r="16" />
    <circle cx="78" cy="70" r="16" />
    <circle cx="60" cy="48" r="14" />
    <circle cx="60" cy="38" r="9" />
    <circle cx="48" cy="46" r="6" />
    <circle cx="73" cy="44" r="5" />
  </g>
  <ellipse cx="60" cy="95" rx="16" ry="7" fill="#fff3c4" opacity="0.32" />
  <ellipse cx="50" cy="76" rx="4" ry="5.5" fill="#2a1206" />
  <ellipse cx="70" cy="76" rx="4" ry="5.5" fill="#2a1206" />
  <path d="M54 87 Q60 92 66 87" fill="none" stroke="#2a1206" stroke-width="2.4" stroke-linecap="round" />
`;

/** `scale` is how much of the tile the blob's 120 box fills. */
function tile(size, scale) {
  const inner = size * scale;
  const x = (size - inner) / 2;
  const y = (size - inner) / 2 + size * 0.02;
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="bg" cx="0.5" cy="0.62" r="0.75">
          <stop offset="0" stop-color="#5a2f6e" />
          <stop offset="1" stop-color="#2a1a4a" />
        </radialGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)" />
      <svg x="${x}" y="${y}" width="${inner}" height="${inner}" viewBox="0 0 120 120">${BLOB}</svg>
    </svg>`);
}

const ICONS = [
  { file: "apple-touch-icon.png", size: 180, scale: 1.0 },
  { file: "icon-192.png", size: 192, scale: 1.0 },
  { file: "icon-512.png", size: 512, scale: 1.0 },
  { file: "icon-512-maskable.png", size: 512, scale: 0.78 },
];

await mkdir(OUT_DIR, { recursive: true });
for (const { file, size, scale } of ICONS) {
  await sharp(tile(size, scale), { density: 144 })
    .resize(size, size)
    .png()
    .toFile(path.join(OUT_DIR, file));
  console.log(`wrote ${file}`);
}

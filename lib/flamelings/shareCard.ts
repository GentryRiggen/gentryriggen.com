import { STAGES } from "./progress";
import type { StageId } from "./types";

/** The picture is 4:5, the shape every phone gallery and chat shows well. */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;

export const SHARE_FOOTER = "gentryriggen.com/flamelings";

const DAY_MS = 86_400_000;

export interface ShareCardInput {
  /**
   * The pet drawn in the Blob's 120 x 120 coordinates, with its styles
   * written onto each element (see `pictureOfPet`), so no page CSS is needed.
   */
  petMarkup: string;
  /** The typed name. Only ever drawn on the picture, never sent anywhere. */
  name: string;
  level: number;
  stage: StageId;
  /** "Cozy Blaze", or "Blaze" before it grows up. */
  stageTitle: string;
  daysAlive: number;
}

/** Whole days since hatching, never negative. */
export function daysAliveSince(bornAt: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - bornAt) / DAY_MS));
}

/** XML-safe text: a child may type anything as a name. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const FONT =
  "ui-rounded, 'SF Pro Rounded', Nunito, system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Longer names get smaller so they always fit between the frame's sides. */
export function nameFontSize(name: string): number {
  const length = [...name].length;
  return Math.max(84, Math.min(130, 130 - Math.max(0, length - 6) * 8));
}

/** Fixed star spots so the same pet always gets the same picture. */
const STARS: readonly (readonly [number, number, number])[] = [
  [120, 330, 3],
  [210, 440, 2.4],
  [300, 360, 3.4],
  [150, 560, 2.2],
  [90, 700, 3],
  [880, 330, 3.2],
  [960, 450, 2.4],
  [790, 390, 2.2],
  [930, 600, 3.4],
  [1000, 720, 2.4],
  [680, 300, 2],
  [430, 330, 2.4],
  [240, 650, 2],
  [840, 560, 2],
];

interface Chip {
  label: string;
  value: string;
  x: number;
  width: number;
  size: number;
}

function chipSvg({ label, value, x, width, size }: Chip): string {
  const mid = x + width / 2;
  return `<g>
  <rect x="${x}" y="1056" width="${width}" height="150" rx="40" fill="#120a24" fill-opacity="0.8" stroke="#f4b860" stroke-opacity="0.55" stroke-width="3"/>
  <text x="${mid}" y="1106" text-anchor="middle" font-size="27" font-weight="800" letter-spacing="3" fill="#f4d9a8">${escapeXml(label)}</text>
  <text x="${mid}" y="1166" text-anchor="middle" font-size="${size}" font-weight="900" fill="#ffffff">${escapeXml(value)}</text>
</g>`;
}

/**
 * The share picture as SVG text: Ember Hollow at dusk in a golden frame,
 * the pet in its current look, and what it has grown into. Pure: no DOM,
 * no network, no clock.
 */
export function composeShareSvg(input: ShareCardInput): string {
  const { petMarkup, name, level, stage, stageTitle, daysAlive } = input;
  const scale = STAGES.find((s) => s.id === stage)?.scale ?? 1;
  // A young pet is smaller, but never lost in the picture.
  const size = Math.round(820 * (0.72 + 0.28 * scale));
  const petX = Math.round(SHARE_WIDTH / 2 - size / 2);
  // The Blob's feet sit at 105 of 120; stand them on the ground.
  const petY = Math.round(990 - size * (105 / 120));
  const days = daysAlive === 0 ? "New!" : String(daysAlive);
  const chips: Chip[] = [
    {
      label: "LEVEL",
      value: String(level),
      x: 60,
      width: 270,
      size: 64,
    },
    {
      label: "GROWN INTO",
      value: stageTitle,
      x: 350,
      width: 380,
      size: stageTitle.length > 11 ? 40 : 46,
    },
    {
      label: "DAYS ALIVE",
      value: days,
      x: 750,
      width: 270,
      size: daysAlive === 0 ? 46 : 64,
    },
  ];
  const stars = STARS.map(
    ([cx, cy, r]) =>
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="0.85"/>`
  ).join("");
  const label = `${name}, level ${level}, ${stageTitle}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHARE_WIDTH}" height="${SHARE_HEIGHT}" viewBox="0 0 ${SHARE_WIDTH} ${SHARE_HEIGHT}" font-family="${FONT}" role="img" aria-label="${escapeXml(label)}">
<defs>
  <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1b1033"/>
    <stop offset="0.5" stop-color="#4a2a6e"/>
    <stop offset="0.8" stop-color="#b8503f"/>
    <stop offset="1" stop-color="#f08a4b"/>
  </linearGradient>
  <linearGradient id="sc-ground" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2f7a3f"/>
    <stop offset="1" stop-color="#134528"/>
  </linearGradient>
  <radialGradient id="sc-glow">
    <stop offset="0" stop-color="#ffb347" stop-opacity="0.75"/>
    <stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
  </radialGradient>
  <clipPath id="sc-inner"><rect x="36" y="36" width="1008" height="1278" rx="56"/></clipPath>
</defs>
<rect width="${SHARE_WIDTH}" height="${SHARE_HEIGHT}" fill="#120a24"/>
<g clip-path="url(#sc-inner)">
  <rect width="${SHARE_WIDTH}" height="${SHARE_HEIGHT}" fill="url(#sc-sky)"/>
  ${stars}
  <path d="M0 880 Q160 790 340 868 T680 848 T1080 868 L1080 1350 L0 1350 Z" fill="#244f4d"/>
  <path d="M0 950 Q200 890 400 940 T800 930 T1080 945 L1080 1350 L0 1350 Z" fill="#1f6a45"/>
  <path d="M0 1018 Q270 985 540 1012 T1080 1008 L1080 1350 L0 1350 Z" fill="url(#sc-ground)"/>
  <ellipse cx="540" cy="840" rx="470" ry="420" fill="url(#sc-glow)"/>
  <ellipse cx="540" cy="996" rx="${Math.round(size * 0.3)}" ry="26" fill="#0b2a18" opacity="0.45"/>
  <svg x="${petX}" y="${petY}" width="${size}" height="${size}" viewBox="0 0 120 120" overflow="visible" style="filter: drop-shadow(0 0 14px rgba(255,140,50,0.65))">${petMarkup}</svg>
  <text x="540" y="128" text-anchor="middle" font-size="30" font-weight="800" letter-spacing="10" fill="#f4d9a8">FLAMELINGS</text>
  <text x="540" y="262" text-anchor="middle" font-size="${nameFontSize(name)}" font-weight="900" fill="#fff6e0" stroke="#2a1a4a" stroke-width="10" paint-order="stroke" stroke-linejoin="round">${escapeXml(name)}</text>
  ${chips.map(chipSvg).join("\n  ")}
  <text x="540" y="1268" text-anchor="middle" font-size="34" font-weight="800" fill="#f4d9a8">${SHARE_FOOTER}</text>
</g>
<rect x="30" y="30" width="1020" height="1290" rx="62" fill="none" stroke="#f4b860" stroke-width="12"/>
<rect x="46" y="46" width="988" height="1258" rx="48" fill="none" stroke="#fff1c9" stroke-opacity="0.45" stroke-width="3"/>
</svg>`;
}

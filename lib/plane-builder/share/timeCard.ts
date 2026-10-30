/** What a "Share my time" card shows. Nothing here identifies a real person. */
export interface TimeCardData {
  worldName: string;
  /** Sim seconds from launch to the finish. */
  time: number;
  /** The generated leaderboard nickname, if the player has one. */
  nickname: string | null;
  /** How far the plane is upgraded, as a whole number. */
  planeLevel: number;
  /** Set on the daily challenge. */
  twist?: { name: string; emoji: string };
}

/** One "level" per upgrade bought across the plane's tracks. */
export function planeLevelOf(tiers: Record<string, number>): number {
  return Object.values(tiers).reduce((sum, tier) => sum + tier, 0);
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export function formatCardTime(seconds: number): string {
  return `${seconds.toFixed(1)} s`;
}

/** The lines the card prints, in order, ready to draw. */
export interface CardText {
  heading: string;
  time: string;
  world: string;
  twist: string | null;
  plane: string;
  nickname: string | null;
  footer: string;
}

export function cardText(data: TimeCardData): CardText {
  const nickname = data.nickname?.trim() ?? "";
  return {
    heading: data.twist ? "Daily challenge" : "Level complete",
    time: formatCardTime(data.time),
    world: data.worldName,
    twist: data.twist ? `${data.twist.emoji} ${data.twist.name}` : null,
    plane: `Plane level ${data.planeLevel}`,
    nickname: nickname === "" ? null : nickname,
    footer: "Made in Plane Builder",
  };
}

/** The text each share carries. No link: the card is the whole message. */
export function shareMessage(data: TimeCardData): string {
  const twist = data.twist ? ` with ${data.twist.name}` : "";
  return `I flew ${data.worldName}${twist} in ${formatCardTime(data.time)} in Plane Builder!`;
}

export function cardFilename(data: TimeCardData): string {
  return data.twist ? "plane-builder-daily.png" : "plane-builder-time.png";
}

type CardContext = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "fillRect"
  | "fillText"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "closePath"
  | "fill"
  | "save"
  | "restore"
  | "createLinearGradient"
>;

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** A small side-on plane, drawn with paths so it needs no image. */
function drawPlane(ctx: CardContext, x: number, y: number, scale: number) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 120 * scale, y - 18 * scale);
  ctx.lineTo(x + 160 * scale, y);
  ctx.lineTo(x + 120 * scale, y + 18 * scale);
  ctx.closePath();
  ctx.fill();
  // Wing
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.moveTo(x + 50 * scale, y);
  ctx.lineTo(x + 20 * scale, y + 62 * scale);
  ctx.lineTo(x + 70 * scale, y + 62 * scale);
  ctx.lineTo(x + 100 * scale, y);
  ctx.closePath();
  ctx.fill();
  // Tail
  ctx.beginPath();
  ctx.moveTo(x + 8 * scale, y);
  ctx.lineTo(x - 18 * scale, y - 42 * scale);
  ctx.lineTo(x + 28 * scale, y - 4 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Paints the time card. Works on any 2D context, so tests can record it. */
export function drawTimeCard(
  ctx: CardContext,
  data: TimeCardData,
  width = CARD_WIDTH,
  height = CARD_HEIGHT
): void {
  const text = cardText(data);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#0284c7");
  sky.addColorStop(1, "#7dd3fc");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(0, height - 68, width, 68);

  drawPlane(ctx, width - 340, 250, 1.6);

  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(text.heading, 70, 60);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 170px ${FONT}`;
  ctx.fillText(text.time, 64, 120);

  ctx.font = `700 54px ${FONT}`;
  ctx.fillText(text.world, 70, 318);

  ctx.font = `600 38px ${FONT}`;
  let y = 384;
  if (text.twist) {
    ctx.fillText(text.twist, 70, y);
    y += 52;
  }
  ctx.fillText(text.plane, 70, y);
  y += 52;
  if (text.nickname) ctx.fillText(`Pilot: ${text.nickname}`, 70, y);

  ctx.fillStyle = "#14532d";
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText(text.footer, 70, height - 50);
}

/** Draws the card on a new canvas and encodes it as a PNG. */
export function renderTimeCard(data: TimeCardData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  drawTimeCard(ctx, data);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

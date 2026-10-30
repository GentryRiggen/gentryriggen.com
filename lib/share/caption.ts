/** The canvas calls the caption needs; a recording stand-in works in tests. */
export type CaptionContext = Pick<
  CanvasRenderingContext2D,
  | "font"
  | "fillStyle"
  | "textBaseline"
  | "textAlign"
  | "fillRect"
  | "fillText"
  | "measureText"
  | "save"
  | "restore"
>;

export const MAX_CAPTION_TITLE_LENGTH = 48;

/** A name safe to print on a picture: no control characters, one line. */
export function cleanCaptionTitle(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CAPTION_TITLE_LENGTH)
    .trim();
  return cleaned || fallback;
}

export interface CaptionLayout {
  titleSize: number;
  subtitleSize: number;
  margin: number;
  padding: number;
  /** The most width the text may take. */
  maxTextWidth: number;
}

/** Sizes scale with the picture, so the caption looks the same on any screen. */
export function captionLayout(width: number, height: number): CaptionLayout {
  const unit = Math.max(12, Math.round(Math.min(width, height * 1.6) * 0.03));
  return {
    titleSize: unit,
    subtitleSize: Math.max(10, Math.round(unit * 0.72)),
    margin: Math.round(unit * 0.9),
    padding: Math.round(unit * 0.6),
    maxTextWidth: Math.round(width * 0.6),
  };
}

/** Shortens `text` with an ellipsis until it fits `maxWidth`. */
export function fitText(
  ctx: Pick<CaptionContext, "measureText">,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (
    end > 1 &&
    ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth
  ) {
    end -= 1;
  }
  return `${text.slice(0, end).trimEnd()}…`;
}

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Draws a small label in the bottom-left corner of a picture. */
export function drawCaption(
  ctx: CaptionContext,
  width: number,
  height: number,
  title: string,
  subtitle: string
): void {
  const layout = captionLayout(width, height);
  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  ctx.font = `700 ${layout.titleSize}px ${FONT_FAMILY}`;
  const shownTitle = fitText(ctx, title, layout.maxTextWidth);
  const titleWidth = ctx.measureText(shownTitle).width;
  ctx.font = `500 ${layout.subtitleSize}px ${FONT_FAMILY}`;
  const subtitleWidth = ctx.measureText(subtitle).width;

  const boxWidth =
    Math.ceil(Math.max(titleWidth, subtitleWidth)) + layout.padding * 2;
  const gap = Math.round(layout.titleSize * 0.2);
  const boxHeight =
    layout.titleSize + gap + layout.subtitleSize + layout.padding * 2;
  const left = layout.margin;
  const top = height - layout.margin - boxHeight;

  ctx.fillStyle = "rgba(15, 23, 42, 0.62)";
  ctx.fillRect(left, top, boxWidth, boxHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${layout.titleSize}px ${FONT_FAMILY}`;
  ctx.fillText(shownTitle, left + layout.padding, top + layout.padding);
  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.font = `500 ${layout.subtitleSize}px ${FONT_FAMILY}`;
  ctx.fillText(
    subtitle,
    left + layout.padding,
    top + layout.padding + layout.titleSize + gap
  );
  ctx.restore();
}

/** A file name for a picture: lowercase letters, digits and dashes only. */
export function pictureFilename(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return `${slug || fallback}.png`;
}

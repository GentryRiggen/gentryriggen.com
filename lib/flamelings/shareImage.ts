import { SHARE_HEIGHT, SHARE_WIDTH } from "./shareCard";

/**
 * Turning the pet on the screen into a PNG, all on the device: the pet's
 * SVG gets its page styles written onto each element, is drawn into the
 * card's SVG, and the browser paints that onto a canvas. No network.
 */

/** What the Blob's CSS decides; copied so the picture needs no stylesheet. */
const STYLE_PROPERTIES = [
  "display",
  "visibility",
  "opacity",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stop-color",
  "stop-opacity",
  "filter",
  "transform",
  "transform-origin",
  "transform-box",
  "mix-blend-mode",
] as const;

const PLAIN_WHEN_NONE = new Set([
  "stroke-dasharray",
  "filter",
  "transform",
  "mix-blend-mode",
]);

/** A computed `url("https://page/#id")` must point at the picture's own id. */
export function localiseUrls(value: string): string {
  return value.replace(
    /url\(\s*["']?[^"')#]*#([^"')\s]+)["']?\s*\)/g,
    "url(#$1)"
  );
}

/**
 * The SVG's children as markup with every element's computed style written
 * inline. The live SVG must be attached and drawn (not `display: none`), and
 * its animations switched off (`fl-share-still`) so the picture is one calm
 * moment.
 */
export function petMarkupOf(live: SVGSVGElement): string {
  const copy = live.cloneNode(true) as SVGSVGElement;
  const from = [...live.querySelectorAll("*")];
  const to = [...copy.querySelectorAll("*")];
  const view = live.ownerDocument.defaultView;
  if (!view) throw new Error("No window to read styles from");
  from.forEach((element, i) => {
    const target = to[i];
    if (!(target instanceof SVGElement)) return;
    const computed = view.getComputedStyle(element);
    const declarations: string[] = [];
    for (const property of STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (!value) continue;
      // Hidden parts must stay hidden (`display: none`, `fill: none`); only
      // the properties whose "none" is the default can be left out.
      if (
        PLAIN_WHEN_NONE.has(property) &&
        (value === "none" || value === "normal")
      )
        continue;
      declarations.push(`${property}:${localiseUrls(value)}`);
    }
    // `filter="url(#goo)"` and `fill="url(#..)"` attributes stay as written.
    target.setAttribute(
      "style",
      declarations.filter((d) => !d.startsWith("filter:url(")).join(";")
    );
    target.removeAttribute("class");
  });
  return new XMLSerializer()
    .serializeToString(copy)
    .replace(/^<svg[^>]*>|<\/svg>$/g, "");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The picture could not be drawn"));
    image.src = url;
  });
}

/** Paints the card SVG on a canvas and returns it as a PNG. */
export async function svgToPng(svg: string): Promise<Blob> {
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.drawImage(image, 0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The picture was empty")),
      "image/png"
    );
  });
}

export type ShareResult = "share" | "download" | "cancelled";

export const SHARE_FILE_NAME = "my-flameling.png";

/** True when this browser can hand a picture to the share sheet. */
export function canShareFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari needs the URL to outlive the click for a moment.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Hands the picture to the share sheet when there is one, and saves it
 * otherwise. Closing the sheet is not an error; a sheet that fails falls
 * back to saving.
 */
export async function shareOrDownload(
  blob: Blob,
  fileName = SHARE_FILE_NAME
): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: "image/png" });
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: "My flameling" });
      return "share";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  download(blob, fileName);
  return "download";
}

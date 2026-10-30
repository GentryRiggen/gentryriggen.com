/** What a picture needs to be shared. */
export interface SharePayload {
  blob: Blob;
  filename: string;
  title: string;
  text: string;
  /** A link to go with the picture. Sent inside the text so every app keeps it. */
  url?: string;
}

export type ShareOutcome =
  | { kind: "shared" }
  | { kind: "cancelled" }
  /** The picture was downloaded because sharing files is not supported. */
  | { kind: "saved"; isLinkCopied: boolean }
  | { kind: "failed" };

/** The browser pieces sharing needs, so tests can stand in for them. */
export interface ShareEnvironment {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  copyText: (text: string) => Promise<boolean>;
  download: (blob: Blob, filename: string) => void;
}

/** The text sent along with a picture: the caption, then the link if any. */
export function shareText(text: string, url?: string): string {
  return url ? `${text} ${url}` : text;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Shares a picture with the system share sheet where it can carry files (iPad
 * and phones). Elsewhere it downloads the picture and copies the link.
 */
export async function shareImage(
  payload: SharePayload,
  env: ShareEnvironment = browserShareEnvironment()
): Promise<ShareOutcome> {
  const { blob, filename, title, text, url } = payload;
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const data: ShareData = {
    files: [file],
    title,
    text: shareText(text, url),
  };

  if (env.share && env.canShare?.({ files: [file] })) {
    try {
      await env.share(data);
      return { kind: "shared" };
    } catch (error) {
      if (isAbort(error)) return { kind: "cancelled" };
      // Any other failure falls back to saving the picture below.
    }
  }

  try {
    env.download(blob, filename);
  } catch {
    return { kind: "failed" };
  }
  const isLinkCopied = url ? await env.copyText(url) : false;
  return { kind: "saved", isLinkCopied };
}

/** Downloads a picture with the browser's own save. */
export function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoking at once can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export function browserShareEnvironment(): ShareEnvironment {
  return {
    share:
      typeof navigator.share === "function"
        ? (data) => navigator.share(data)
        : undefined,
    canShare:
      typeof navigator.canShare === "function"
        ? (data) => navigator.canShare(data)
        : undefined,
    copyText: async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    },
    download: downloadBlob,
  };
}

/** A canvas as a PNG, or null when the browser cannot encode it. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** A plain-words line telling the player what just happened. */
export function describeOutcome(outcome: ShareOutcome): string {
  switch (outcome.kind) {
    case "shared":
      return "Shared!";
    case "cancelled":
      return "";
    case "saved":
      return outcome.isLinkCopied
        ? "Picture saved and link copied"
        : "Picture saved";
    case "failed":
      return "Couldn't share that picture";
  }
}

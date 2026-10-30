import {
  captionLayout,
  cleanCaptionTitle,
  drawCaption,
  fitText,
  pictureFilename,
  MAX_CAPTION_TITLE_LENGTH,
  type CaptionContext,
} from "../caption";

/** A fake canvas context: 10 px per character, and a record of the drawing. */
function makeContext() {
  const calls: { fn: string; args: unknown[] }[] = [];
  const ctx = {
    font: "",
    fillStyle: "",
    textBaseline: "alphabetic",
    textAlign: "start",
    save: () => calls.push({ fn: "save", args: [] }),
    restore: () => calls.push({ fn: "restore", args: [] }),
    fillRect: (...args: unknown[]) => calls.push({ fn: "fillRect", args }),
    fillText: (...args: unknown[]) => calls.push({ fn: "fillText", args }),
    measureText: (text: string) => ({ width: text.length * 10 }),
  };
  return { ctx: ctx as unknown as CaptionContext, calls };
}

describe("cleanCaptionTitle", () => {
  it("collapses whitespace and control characters", () => {
    expect(cleanCaptionTitle("  The\n  Big\tBoat ", "x")).toBe("The Big Boat");
  });
  it("falls back when the name is empty", () => {
    expect(cleanCaptionTitle("   ", "My ship")).toBe("My ship");
  });
  it("caps the length", () => {
    const long = "a".repeat(200);
    expect(cleanCaptionTitle(long, "x")).toHaveLength(MAX_CAPTION_TITLE_LENGTH);
  });
});

describe("captionLayout", () => {
  it("scales with the picture", () => {
    expect(captionLayout(2000, 1400).titleSize).toBeGreaterThan(
      captionLayout(500, 350).titleSize
    );
  });
  it("never gets unreadably small", () => {
    expect(captionLayout(10, 10).titleSize).toBeGreaterThanOrEqual(12);
  });
});

describe("fitText", () => {
  it("leaves short text alone", () => {
    const { ctx } = makeContext();
    expect(fitText(ctx, "short", 100)).toBe("short");
  });
  it("shortens long text with an ellipsis", () => {
    const { ctx } = makeContext();
    const fitted = fitText(ctx, "a very long ship name", 100);
    expect(fitted.endsWith("…")).toBe(true);
    expect(ctx.measureText(fitted).width).toBeLessThanOrEqual(100);
  });
});

describe("drawCaption", () => {
  it("draws the title and the subtitle inside the picture, bottom-left", () => {
    const { ctx, calls } = makeContext();
    drawCaption(ctx, 1600, 1000, "Sea Queen", "Made in Ship Builder");
    const texts = calls.filter((c) => c.fn === "fillText");
    expect(texts.map((c) => c.args[0])).toEqual([
      "Sea Queen",
      "Made in Ship Builder",
    ]);
    const [x, y, w, h] = calls.find((c) => c.fn === "fillRect")!
      .args as number[];
    expect(x).toBeGreaterThan(0);
    expect(x + w).toBeLessThan(1600);
    expect(y + h).toBeLessThan(1000);
    expect(y).toBeGreaterThan(500);
  });

  it("restores the context it saved", () => {
    const { ctx, calls } = makeContext();
    drawCaption(ctx, 800, 600, "A", "B");
    expect(calls[0].fn).toBe("save");
    expect(calls[calls.length - 1].fn).toBe("restore");
  });
});

describe("pictureFilename", () => {
  it("makes a safe lowercase name", () => {
    expect(pictureFilename("Sea Queen!! #2", "ship")).toBe("sea-queen-2.png");
  });
  it("falls back when nothing usable is left", () => {
    expect(pictureFilename("★★★", "ship")).toBe("ship.png");
  });
  it("never contains path characters", () => {
    expect(pictureFilename("../../etc/passwd", "ship")).toBe("etc-passwd.png");
  });
});

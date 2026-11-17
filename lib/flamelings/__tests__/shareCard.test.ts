import {
  composeShareSvg,
  daysAliveSince,
  escapeXml,
  nameFontSize,
  SHARE_FOOTER,
  type ShareCardInput,
} from "../shareCard";
import { localiseUrls } from "../shareImage";

const BASE: ShareCardInput = {
  petMarkup: '<circle id="the-pet" r="5"/>',
  name: "Pip",
  level: 12,
  stage: "blaze",
  stageTitle: "Cozy Blaze",
  daysAlive: 3,
};

describe("composeShareSvg", () => {
  it("is a 1080 x 1350 picture with the pet, name, level, form, days and footer", () => {
    const svg = composeShareSvg(BASE);
    expect(svg).toContain('width="1080" height="1350"');
    expect(svg).toContain('id="the-pet"');
    expect(svg).toContain(">Pip</text>");
    expect(svg).toContain(">12</text>");
    expect(svg).toContain(">Cozy Blaze</text>");
    expect(svg).toContain(">3</text>");
    expect(svg).toContain(`>${SHARE_FOOTER}</text>`);
    expect(SHARE_FOOTER).toBe("gentryriggen.com/flamelings");
  });

  it("makes no network request: nothing external is referenced", () => {
    const svg = composeShareSvg(BASE);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    expect(svg).not.toContain("<image");
    expect(svg).not.toContain("@import");
  });

  it("escapes a typed name so it cannot add markup", () => {
    const svg = composeShareSvg({ ...BASE, name: "<script>\"&'" });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&quot;&amp;&apos;");
  });

  it("says New! for a pet hatched today", () => {
    expect(composeShareSvg({ ...BASE, daysAlive: 0 })).toContain(
      ">New!</text>"
    );
  });

  it("draws a bigger pet for a later stage", () => {
    const size = (stage: ShareCardInput["stage"]) =>
      Number(
        /<svg x="\d+" y="-?\d+" width="(\d+)"/.exec(
          composeShareSvg({ ...BASE, stage })
        )![1]
      );
    expect(size("spark")).toBeLessThan(size("blaze"));
    expect(size("blaze")).toBeLessThan(size("bonfire"));
    expect(size("spark")).toBeGreaterThan(500);
  });

  it("keeps the pet inside the frame at every stage", () => {
    for (const stage of [
      "spark",
      "flicker",
      "flame",
      "blaze",
      "bonfire",
    ] as const) {
      const [, x, y, w] = /<svg x="(\d+)" y="(-?\d+)" width="(\d+)"/
        .exec(composeShareSvg({ ...BASE, stage }))!
        .map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(1080);
      expect(y).toBeGreaterThan(200);
    }
  });
});

describe("nameFontSize", () => {
  it("shrinks long names but stays readable", () => {
    expect(nameFontSize("Pip")).toBe(130);
    expect(nameFontSize("Captain Zoomy")).toBeLessThan(130);
    expect(nameFontSize("x".repeat(40))).toBe(84);
  });
});

describe("daysAliveSince", () => {
  const DAY = 86_400_000;
  it("counts whole days and never goes negative", () => {
    expect(daysAliveSince(0, DAY * 3 + 5)).toBe(3);
    expect(daysAliveSince(DAY, 0)).toBe(0);
  });
});

describe("escapeXml", () => {
  it("escapes the five XML characters", () => {
    expect(escapeXml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&apos;");
  });
});

describe("localiseUrls", () => {
  it("points a computed absolute url back at the picture's own id", () => {
    expect(
      localiseUrls('url("http://localhost:3000/flamelings#fl-fill-r1")')
    ).toBe("url(#fl-fill-r1)");
    expect(localiseUrls("url(#a)")).toBe("url(#a)");
    expect(localiseUrls("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
  });
});

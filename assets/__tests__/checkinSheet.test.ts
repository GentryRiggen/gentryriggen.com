import * as sheet from "../../scripts/assets/checkinSheet.mjs";
import funnel from "../parts/funnel.json";

const { buildSheet, buildFamilySheet } = sheet as unknown as {
  buildSheet: (...args: unknown[]) => string;
  buildFamilySheet: (rows: unknown[], ids: string[]) => string;
};

const score = {
  round: 3,
  total: 0.5,
  silhouette: 0.6,
  detail: 0.4,
  gates: funnel.variants.map((v) => ({
    name: "bounds",
    ok: true,
    detail: "fine",
    variant: v.name,
  })),
  triangles: { funnel: 100, "funnel-large": 200 },
  bytes: { funnel: 1, "funnel-large": 2 },
};

const masked = {
  file: "masked.jpg",
  view: "side",
  crop: [0, 0, 10, 10],
  mask: { mode: "luma", threshold: 0.5 },
};
const unmasked = { file: "plain.jpg", view: null, crop: null, mask: null };
const shot = (part: string, view: string, build: string) => ({
  part,
  view,
  build,
  file: `/nonexistent/${part}-${view}-${build}.png`,
  error: null,
  consoleErrors: [],
});

describe("check-in sheets", () => {
  it("builds the single-part sheet, with each view's references", () => {
    const shots = funnel.views.flatMap((v) =>
      ["old", "new"].map((b) => shot("funnel", v.name, b))
    );
    const html = buildSheet(
      funnel,
      score,
      [{ round: 3, total: 0.5 }],
      shots,
      [masked, unmasked],
      []
    );
    expect(html).toContain("funnel check-in, round 3");
    expect(html).toContain("masked.jpg");
    expect(html).toContain("plain.jpg"); // the general ref row
    expect(html).toContain("three-quarter");
  });

  it("builds the family sheet with every reference, masked or not", () => {
    const row = (id: string) => ({
      part: {
        id,
        specId: "funnel",
        variant: id,
        spec: funnel,
      },
      score,
      manifestEntries: [masked, unmasked],
      shots: [
        shot(id, "three-quarter", "old"),
        shot(id, "three-quarter", "new"),
      ],
    });
    const html = buildFamilySheet(
      [row("funnel"), row("funnel-large")],
      ["funnel", "funnel-large"]
    );
    expect(html).toContain("funnel, funnel-large");
    // Two references in each of the two rows.
    expect(html.match(/<div class="ref"/g)?.length).toBe(4);
    expect(html).toContain("plain.jpg");
    expect(html).toContain("masked.jpg");
    // Only the masked one gets a mask thumbnail.
    expect(html.match(/class="refmask"/g)?.length).toBe(2);
    expect(html).toContain("(spec total)"); // funnel-large is not the score variant
    expect(html).not.toContain("no ref");
  });

  it("says so when a part has no references", () => {
    const html = buildFamilySheet(
      [
        {
          part: {
            id: "funnel",
            specId: "funnel",
            variant: "funnel",
            spec: funnel,
          },
          score,
          manifestEntries: [],
          shots: [
            shot("funnel", "three-quarter", "old"),
            shot("funnel", "three-quarter", "new"),
          ],
        },
      ],
      ["funnel"]
    );
    expect(html).toContain("no ref");
  });
});

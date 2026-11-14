import { normalizePath, siteForPath } from "../site";

describe("siteForPath", () => {
  it.each([
    ["/", "home"],
    ["/ship-builder", "ship-builder"],
    ["/ship-builder/", "ship-builder"],
    ["/ship-builder/versions", "ship-builder"],
    ["/plane-builder", "plane-builder"],
    ["/plane-builder/", "plane-builder"],
    ["/plane-builder/versions", "plane-builder"],
    ["/planet-smasher", "planet-smasher"],
    ["/planet-smasher/", "planet-smasher"],
    ["/planet-smasher/versions", "planet-smasher"],
    ["/ever-onward", "ever-onward"],
    ["/ever-onward/", "ever-onward"],
    ["/ever-onward/versions", "ever-onward"],
    ["/admin", null],
    ["/nope", null],
    ["/ship-builders", null],
    ["/plane-builderx", null],
    ["/planet-smasherx", null],
    ["/planet-smashers", null],
    ["/ever-onwards", null],
    ["/ever-onward.html", null],
  ])("%s -> %s", (path, site) => {
    expect(siteForPath(path)).toBe(site);
  });
});

describe("normalizePath", () => {
  it("strips trailing slashes but keeps the root", () => {
    expect(normalizePath("/a/b/")).toBe("/a/b");
    expect(normalizePath("/")).toBe("/");
  });

  it("caps the length at 200", () => {
    expect(normalizePath("/" + "a".repeat(500))).toHaveLength(200);
  });
});

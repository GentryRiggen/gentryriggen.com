import { normalizePath, siteForPath } from "../site";

describe("siteForPath", () => {
  it.each([
    ["/", "home"],
    ["/ship-builder", "ship-builder"],
    ["/ship-builder/", "ship-builder"],
    ["/ship-builder/versions", "ship-builder"],
    ["/admin", null],
    ["/nope", null],
    ["/ship-builders", null],
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

import sitemap from "../sitemap";

describe("sitemap", () => {
  it("lists the home page and the ship builder", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://gentryriggen.com",
      "https://gentryriggen.com/ship-builder",
    ]);
  });
});

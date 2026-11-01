import sitemap from "../sitemap";

describe("sitemap", () => {
  it("lists the home page and the games", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://gentryriggen.com",
      "https://gentryriggen.com/ship-builder",
      "https://gentryriggen.com/plane-builder",
      "https://gentryriggen.com/little-machines",
    ]);
  });
});

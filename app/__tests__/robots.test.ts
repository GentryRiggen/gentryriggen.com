import robots from "../robots";
import sitemap from "../sitemap";

describe("robots", () => {
  it("disallows /admin", () => {
    const rules = robots().rules;
    const first = Array.isArray(rules) ? rules[0] : rules;
    expect(first.disallow).toContain("/admin");
  });

  it("keeps /admin out of the sitemap", () => {
    expect(sitemap().some((entry) => entry.url.includes("/admin"))).toBe(false);
  });
});

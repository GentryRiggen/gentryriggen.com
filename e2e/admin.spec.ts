import { test, expect } from "@playwright/test";

test.describe("Admin", () => {
  test("signed out visitors see no dashboard", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
  });

  test("is not indexable", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    );
  });
});

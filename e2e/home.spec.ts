import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should display the main heading", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Hello, I'm/);
    await expect(heading).toContainText("Gentry Riggen");
  });

  test("should navigate to about section when clicking About link", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "About" }).click();
    await expect(page.locator("#about")).toBeVisible();
  });

  test("should navigate to contact section when clicking Contact link", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Contact" }).click();
    await expect(page.locator("#contact")).toBeVisible();
  });

  test("should have working email link", async ({ page }) => {
    await page.goto("/");
    const emailLink = page.getByRole("link", { name: "Send Email" });
    await expect(emailLink).toHaveAttribute(
      "href",
      "mailto:hello@gentryriggen.com"
    );
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.getByText(/Hello, I'm/)).toBeVisible();
  });
});

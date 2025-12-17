import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("should display the main heading with GENTRY and RIGGEN", async ({
    page,
  }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("GENTRY");
    await expect(heading).toContainText("RIGGEN");
  });

  test("should display the subtitle", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Software Leader & Developer")).toBeVisible();
  });

  test("should display the hero image", async ({ page }) => {
    await page.goto("/");
    const image = page.getByAltText("Gentry Riggen");
    await expect(image).toBeVisible();
  });

  test("should have working LinkedIn link", async ({ page }) => {
    await page.goto("/");
    const linkedinLink = page.getByRole("link", { name: "LinkedIn" });
    await expect(linkedinLink).toBeVisible();
    await expect(linkedinLink).toHaveAttribute(
      "href",
      "https://linkedin.com/in/gentryriggen"
    );
    await expect(linkedinLink).toHaveAttribute("target", "_blank");
    await expect(linkedinLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("should have working GitHub link", async ({ page }) => {
    await page.goto("/");
    const githubLink = page.getByRole("link", { name: "GitHub" });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/gentryriggen"
    );
    await expect(githubLink).toHaveAttribute("target", "_blank");
    await expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("should display copyright text", async ({ page }) => {
    await page.goto("/");
    const currentYear = new Date().getFullYear();
    await expect(
      page.getByText(`© ${currentYear} Gentry Riggen`)
    ).toBeVisible();
  });

  test("should be responsive on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.getByText("GENTRY")).toBeVisible();
    await expect(page.getByText("RIGGEN")).toBeVisible();
  });

  test("should have theme toggle button", async ({ page }) => {
    await page.goto("/");
    const themeToggle = page.getByRole("button", { name: "Toggle theme" });
    await expect(themeToggle).toBeVisible();
  });

  test("should toggle theme when clicking theme button", async ({ page }) => {
    await page.goto("/");
    const themeToggle = page.getByRole("button", { name: "Toggle theme" });

    // Get initial theme class
    const initialClass = await page.locator("html").getAttribute("class");

    // Click the toggle
    await themeToggle.click();

    // Wait a bit for the theme to change
    await page.waitForTimeout(100);

    // Check that the theme class changed
    const newClass = await page.locator("html").getAttribute("class");
    expect(newClass).not.toBe(initialClass);
  });

  test("should display main content text", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText(/I build products and lead teams/)
    ).toBeVisible();
  });
});

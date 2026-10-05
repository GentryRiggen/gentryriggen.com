import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test(
    "should display the terminal window",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("gentry@portfolio ~ (bash)")).toBeVisible();
    }
  );

  test("should display the ASCII art banner", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome to Gentry Riggen")).toBeVisible();
  });

  test("should display the profile image after typing completes", async ({
    page,
  }) => {
    await page.goto("/");
    const image = page.getByAltText("Gentry Riggen");
    await expect(image).toBeVisible({ timeout: 15000 });
  });

  test("should display copyright text", async ({ page }) => {
    await page.goto("/");
    const currentYear = new Date().getFullYear();
    await expect(
      page.getByText(`© ${currentYear} Gentry Riggen`)
    ).toBeVisible();
  });

  test(
    "the `ships` command opens the ship builder",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/");
      const input = page.getByLabel("Terminal command input");
      // The prompt only appears once the boot sequence has finished typing.
      await expect(input).toBeVisible({ timeout: 40000 });
      await input.fill("ships");
      await input.press("Enter");
      await expect(page).toHaveURL(/\/ship-builder$/, { timeout: 10000 });
      await expect(
        page.getByRole("heading", { name: "Ship Builder" })
      ).toBeVisible();
    }
  );

  test(
    "should be responsive on mobile viewport",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      await expect(page.getByText("gentry@portfolio ~ (bash)")).toBeVisible();
    }
  );

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

  test("should display bio text after typing animation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/I build products and lead teams/)).toBeVisible(
      { timeout: 15000 }
    );
  });

  test("should display social links after typing animation", async ({
    page,
  }) => {
    await page.goto("/");
    const linkedinLink = page.getByRole("link", {
      name: "https://linkedin.com/in/gentryriggen",
    });
    await expect(linkedinLink).toBeVisible({ timeout: 20000 });
    await expect(linkedinLink).toHaveAttribute(
      "href",
      "https://linkedin.com/in/gentryriggen"
    );
  });
});

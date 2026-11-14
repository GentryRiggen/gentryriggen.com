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
});

/* The inline theme script in app/layout.tsx runs on every page; a syntax
   error there breaks them all, so check a few kinds of page. */
for (const path of ["/", "/jim", "/ship-builder/versions"]) {
  test(
    `${path} loads without script errors`,
    { tag: "@smoke" },
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.goto(path);
      await page.waitForLoadState("load");
      expect(errors).toEqual([]);
    }
  );
}

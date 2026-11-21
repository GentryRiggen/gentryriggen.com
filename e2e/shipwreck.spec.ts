import { test, expect } from "@playwright/test";

test("the title screen loads with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/shipwreck");
  await page.waitForFunction(() => Boolean(window.__shipwreck));
  await expect(page.getByTestId("shipwreck-title")).toHaveText("Shipwreck");
  await expect(page.getByText(/More than 1,500 people died/)).toBeVisible();
  expect(await page.evaluate(() => window.__shipwreck!.getScreen())).toBe(
    "title"
  );
  const link = page.getByRole("link", { name: /What's new/ });
  await expect(link).toHaveAttribute("href", "/shipwreck/versions");
  expect(errors).toEqual([]);
});

test("the versions page lists the coming-soon release", async ({ page }) => {
  await page.goto("/shipwreck/versions");
  await expect(page.getByText(/Coming soon/).first()).toBeVisible();
});

for (const [width, height] of [
  [744, 1133],
  [1133, 744],
  [390, 844],
]) {
  test(`the title screen fits ${width}x${height} without scrolling sideways @smoke`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/shipwreck");
    await expect(page.getByTestId("shipwreck-title")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

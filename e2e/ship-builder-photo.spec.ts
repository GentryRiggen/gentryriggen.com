import { test, expect, type Page } from "@playwright/test";

// Software WebGL on a CI runner can take most of the default timeout.
test.setTimeout(120_000);

async function openBuilder(page: Page) {
  await page.goto("/ship-builder");
  await expect(
    page.getByRole("heading", { name: "Ship Builder" })
  ).toBeVisible();
  await expect(page.getByTestId("ship-canvas").locator("canvas")).toBeVisible();
}

test.describe("Ship Builder photo mode", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== "chromium",
      "WebGL is only reliable in headless Chromium"
    );
  });

  test("hides the building controls, takes a captioned picture and leaves", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await openBuilder(page);

    await page.getByRole("button", { name: "Photo", exact: true }).click();
    const photo = page.getByTestId("photo-mode");
    await expect(photo).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ship Builder" })
    ).toBeHidden();

    // The angle, time and sea chips stay on hand.
    const angles = photo.getByRole("group", { name: "Photo angle" });
    await angles.getByRole("button", { name: "Bow-on" }).click();
    await expect(
      angles.getByRole("button", { name: "Bow-on" })
    ).toHaveAttribute("aria-pressed", "true");
    await angles.getByRole("button", { name: "Dramatic low" }).click();
    await page.getByRole("button", { name: "Sunset", exact: true }).click();
    await expect(page.getByRole("button", { name: "Calm sea" })).toBeVisible();

    await photo.getByRole("button", { name: "Take photo" }).click();
    const preview = page.getByTestId("photo-preview");
    await expect(preview).toBeVisible();
    // The picture decoded to real pixels.
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(100);
    await expect(
      page.getByRole("button", { name: "Save picture" })
    ).toBeVisible();

    // Escape closes the preview first, then photo mode.
    await page.keyboard.press("Escape");
    await expect(preview).toBeHidden();
    await expect(photo).toBeVisible();
    await photo.getByRole("button", { name: "Done" }).click();
    await expect(photo).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Ship Builder" })
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("greets a friend who opens a share link", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("button", { name: "Share" }).click();
    const link = await page.getByLabel("Share link URL").inputValue();

    await page.goto("about:blank");
    await page.goto(link);
    const banner = page.getByRole("region", { name: "Shared ship" });
    await expect(banner).toContainText("A friend shared this ship!");

    await banner.getByRole("button", { name: "Keep a copy" }).click();
    await expect(banner).toBeHidden();
    await expect(page.getByText("Saved to My Ships")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe("Ship Builder time of day", () => {
  test("switches to sunset and night and keeps the scene rendering", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "WebGL is only reliable in headless Chromium"
    );
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/ship-builder");
    await expect(
      page.getByRole("heading", { name: "Ship Builder" })
    ).toBeVisible();
    const canvas = page.getByTestId("ship-canvas").locator("canvas");
    await expect(canvas).toBeVisible();

    const day = page.getByRole("button", { name: "Day", exact: true });
    const sunset = page.getByRole("button", { name: "Sunset", exact: true });
    const night = page.getByRole("button", { name: "Night", exact: true });
    await expect(day).toHaveAttribute("aria-pressed", "true");

    await night.click();
    await expect(night).toHaveAttribute("aria-pressed", "true");
    await expect(day).toHaveAttribute("aria-pressed", "false");
    await expect(canvas).toBeVisible();

    await sunset.click();
    await expect(sunset).toHaveAttribute("aria-pressed", "true");
    await expect(night).toHaveAttribute("aria-pressed", "false");
    await expect(canvas).toBeVisible();

    // The choice is remembered on this device across a reload.
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Sunset", exact: true })
    ).toHaveAttribute("aria-pressed", "true");

    // Weather and time combine: a stormy night still renders.
    await page.getByRole("button", { name: "Night", exact: true }).click();
    await page.getByRole("button", { name: "Stormy sea" }).click();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.height).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  });

  test("keeps the view controls from overlapping at common widths", async ({
    page,
  }) => {
    for (const width of [390, 820, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/ship-builder");
      await expect(
        page.getByRole("group", { name: "Time of day" })
      ).toBeVisible();
      const boxes = await Promise.all(
        ["Camera", "Sea", "Time of day"].map((name) =>
          page.getByRole("group", { name }).boundingBox()
        )
      );
      const [camera, sea, time] = boxes;
      expect(camera && sea && time).toBeTruthy();
      const overlaps = (
        a: NonNullable<typeof camera>,
        b: NonNullable<typeof camera>
      ) =>
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height;
      expect(overlaps(camera!, sea!)).toBe(false);
      expect(overlaps(camera!, time!)).toBe(false);
      expect(overlaps(sea!, time!)).toBe(false);
    }
  });
});

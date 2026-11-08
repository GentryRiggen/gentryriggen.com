import { test, expect, type Page } from "@playwright/test";

/** Opens the page and taps through the start screen to the hub. */
async function openHub(page: Page) {
  await page.goto("/ever-onward");
  await page.getByTestId("eo-start-button").click();
}

/** Gets past a phase cutscene: skip to the goal, then start. */
async function passCutscene(page: Page) {
  const overlay = page.getByTestId("lm-phase-overlay");
  await overlay.getByRole("button", { name: "Skip" }).click();
  await overlay.getByRole("button", { name: "Start" }).click();
}

/** Starts a fresh game and gets past the opening moment. */
async function startGame(page: Page) {
  await openHub(page);
  await page.getByTestId("lm-play-light").click();
  await passCutscene(page);
}

test.describe("Ever Onward", () => {
  test("Test mode jumps into any part and leaves the real game alone", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make It Grow" })
      .click();
    await page.getByTestId("eo-jump-grow-2-in").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The Whole World"
    );
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByTestId("eo-test-speed-20").click();
    await page.getByTestId("eo-test-exit").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The Coast"
    );
    const saved = await page.evaluate(() =>
      window.localStorage.getItem("ever-onward:save")
    );
    expect(saved).not.toContain('"grow"');
  });

  test("the backyard's bees work flower beds in the panel and the picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make It Grow" })
      .click();
    await page.getByTestId("eo-jump-grow-0-late").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("eo-pollen")).toBeAttached();
    await expect(page.getByTestId("eo-flower-bed-0")).toBeAttached();
    const panel = page.getByTestId("eo-bees");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("eo-bed-0")).toBeVisible();
    await expect(panel.getByTestId("eo-bees-honey")).toContainText("Honey");
  });

  test("the coast's harbor toll and oil market show in the panels and the picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByTestId("eo-jump-light-0-late").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    // The harbor desk: the plus and the minus of every toll, and the rival's sign.
    const harbor = page.getByTestId("lm-harbor");
    await expect(harbor).toBeVisible();
    await expect(harbor.getByRole("radio")).toHaveCount(5);
    await expect(harbor.getByTestId("lm-harbor-rival")).toContainText("x");
    await expect(harbor.getByTestId("lm-toll-boats-0")).toBeAttached();
    // The lamp panel keeps its brightness knob beside the oil market, and
    // never says which step is best.
    const lamp = page.getByTestId("lm-lamp");
    await expect(lamp).toBeVisible();
    await expect(lamp.getByRole("radio")).toHaveCount(4);
    await expect(lamp).not.toContainText(/best/i);
    // The picture: the toll sign on the quay, ships on the water, the tank.
    await expect(page.getByTestId("lm-toll-sign")).toBeAttached();
    await expect(page.getByTestId("lm-harbor-ships")).toBeAttached();
    await expect(page.getByTestId("lm-tank-fill")).toBeAttached();
    // Setting a toll shows in the panel and the sign.
    await harbor.getByTestId("lm-toll-3").click();
    await expect(harbor).toHaveAttribute("data-step", "3");
    await expect(page.getByTestId("lm-toll-sign")).toHaveAttribute(
      "data-step",
      "3"
    );
  });

  test("the night's grid and crews show in the panels and the picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByTestId("eo-jump-light-1-late").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 60_000,
    });
    // The grid panel: the day, tonight's rush and what carries it. It shows
    // what you would see (how big tonight looks, how full the bank is) and
    // never both sides of a sum, nor which streetlights to pick.
    const grid = page.getByTestId("lm-grid");
    await expect(grid).toBeVisible();
    await expect(grid.getByTestId("lm-day-strip")).toBeAttached();
    await expect(grid.getByTestId("lm-grid-tonight")).toContainText(/evening/);
    await expect(grid.getByTestId("lm-grid-bars")).toBeAttached();
    await expect(grid.getByTestId("lm-grid-batteries")).toBeVisible();
    await expect(grid).not.toContainText(/best|recommend|asks|holds/i);
    await expect(grid).not.toContainText(/\d+(\.\d)? s\b/);
    const lamps = page.getByTestId("lm-lamps");
    await expect(lamps).not.toContainText(/rush hits \d/i);
    // The crews: each on a post; a tap sends one, and it spends time on the road.
    const crews = page.getByTestId("lm-crews");
    await expect(crews).toBeVisible();
    await expect(crews).toContainText(/sandbags and wages/);
    // The test mode's player has already posted its crews; send a crew that is
    // not committed to a storm watch to whichever of building and the school
    // it is not at.
    let crewId = 1;
    if (
      (await page.getByTestId("lm-crew-1").getAttribute("data-committed")) ===
      "true"
    )
      crewId = 0;
    const crew = page.getByTestId(`lm-crew-${crewId}`);
    const at = await crew.getAttribute("data-post");
    const other = at === "0" ? 1 : 0;
    await crews.getByTestId(`lm-crew-${crewId}-post-${other}`).click();
    await expect(crew).toHaveAttribute("data-moving", "true");
    await expect(crew).toHaveAttribute("data-post", String(other));
    // The picture: the sky's clock, the battery bank and the crews at their posts.
    await expect(page.getByTestId("lm-night-sky")).toBeAttached();
    await expect(page.getByTestId("lm-bank")).toBeAttached();
    await expect(page.getByTestId("lm-station-build")).toBeAttached();
    await expect(page.getByTestId("lm-station-school")).toBeAttached();
  });

  test("the old window box turns the blind, and the picture shows the light and the leaves", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make It Grow" })
      .click();
    await page.getByTestId("eo-jump-grow-3-in").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    const panel = page.getByTestId("eo-windowbox");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("eo-windowbox-leaves")).toBeVisible();
    await expect(panel.getByTestId("eo-windowbox-sky")).toBeVisible();
    await expect(page.getByTestId("eo-leaves")).toBeAttached();
    const blind = page.getByTestId("eo-blind");
    await expect(blind).toBeAttached();
    // The blind takes a few seconds to open all the way.
    await panel.getByRole("button", { name: "More sun" }).click();
    await panel.getByRole("button", { name: "More sun" }).click();
    await expect(blind).toHaveAttribute("data-light", "8", { timeout: 20_000 });
    await expect(
      panel.getByRole("button", { name: "More sun" })
    ).toHaveAttribute("aria-disabled", "true");
    await panel.getByRole("button", { name: "More shade" }).click();
    await panel.getByRole("button", { name: "More shade" }).click();
    await expect(blind).toHaveAttribute("data-light", "0", { timeout: 20_000 });
    await expect(
      panel.getByRole("button", { name: "More shade" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("the farm plants for harvest day and tends a prize pumpkin in the panels and the picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make It Grow" })
      .click();
    await page.getByTestId("eo-jump-grow-1-late").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("eo-farm-day")).toBeAttached();
    await expect(page.getByTestId("eo-field-0")).toBeAttached();
    await expect(page.getByTestId("eo-prize-pumpkin")).toBeAttached();
    const market = page.getByTestId("lm-market");
    await expect(market).toBeVisible();
    await expect(market.getByRole("radio")).toHaveCount(4);
    await expect(market.getByTestId("lm-soil")).toContainText("Soil");
    const pumpkin = page.getByTestId("lm-pumpkin");
    await expect(pumpkin).toBeVisible();
    await expect(pumpkin.getByTestId("lm-pumpkin-feed")).toContainText(
      "Chance it splits"
    );
    // Planting puts a crop in the ground, in the panel and in the picture.
    await market.getByRole("radio", { name: "Corn" }).click();
    await expect(market).toHaveAttribute("data-planted", "corn");
    await expect(page.getByTestId("eo-field-0")).not.toHaveAttribute(
      "data-stage",
      "0"
    );
  });

  test("the world mixes biomes with sliders and the picture shows the water", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make It Grow" })
      .click();
    await page.getByTestId("eo-jump-grow-2-late").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    const globe = page.getByTestId("lm-globe");
    await expect(globe).toBeAttached();
    await expect(globe).toHaveAttribute("data-water", /\d+/);
    const mix = page.getByTestId("lm-biomes");
    await expect(mix).toBeVisible();
    await expect(mix.getByTestId("lm-biomes-jungle")).toBeVisible();
    const jungle = mix.getByTestId("lm-biomes-jungle");
    const before = Number(await jungle.getAttribute("data-points"));
    await mix.getByTestId("lm-mix-more-jungle").click();
    await expect(jungle).toHaveAttribute("data-points", String(before + 1));
  });

  test("what you do together: three activities, the friend's face hint and the picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make Everyone Smile" })
      .click();
    await page.getByTestId("eo-jump-smile-0-late").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    const panel = page.getByTestId("ms-together");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("ms-together-face")).toContainText(
      "Their face looks like it wants"
    );
    await expect(page.getByTestId("eo-together-scene")).toBeAttached();
    await expect(page.getByTestId("eo-face-hint")).toBeAttached();
    for (const i of [0, 1, 2]) {
      await expect(panel.getByTestId(`ms-together-${i}`)).toContainText("+ ");
    }
    // Whatever the run was doing when we jumped in, pick something else.
    await panel.locator('[role="radio"][aria-checked="false"]').first().click();
    await expect(panel).toHaveAttribute("data-switching", "yes");
    await expect(page.getByTestId("eo-together-scene")).toBeAttached();
  });

  test("the quiet: sit closer, read the bench and the picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make Everyone Smile" })
      .click();
    await page.getByTestId("eo-jump-smile-3-in").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    const panel = page.getByTestId("ms-bench");
    await expect(panel).toBeVisible();
    await expect(panel.getByTestId("ms-bench-tell")).toContainText(/\w/);
    for (const id of ["ms-bench-closer", "ms-bench-back"]) {
      await expect(panel.getByTestId(id)).toContainText("+ ");
      await expect(panel.getByTestId(id)).toContainText("− ");
    }
    await expect(page.getByTestId("eo-bench-scene")).toBeAttached();
    await expect(page.getByTestId("eo-bench-friend")).toBeAttached();
    // Whatever seat the jump landed on, scoot back one: it takes a moment,
    // and the robot is already on its way.
    const seat = Number(await panel.getAttribute("data-seat"));
    expect(seat).toBeGreaterThan(0);
    await panel.getByTestId("ms-bench-back").click();
    await expect(panel).toHaveAttribute("data-moving", "yes");
    await expect(page.getByTestId("eo-bench-robot")).toHaveAttribute(
      "data-at",
      String(seat - 1)
    );
  });

  test("the town: lemonade stand price, parade route floats and the picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make Everyone Smile" })
      .click();
    await page.getByTestId("eo-jump-smile-1-in").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    const panel = page.getByTestId("ms-town");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("ms-meter")).toHaveCount(0);
    await expect(page.getByTestId("eo-town-dials")).toBeAttached();
    await expect(page.getByTestId("eo-stand")).toBeAttached();
    for (const i of [0, 1, 2, 3, 4]) {
      await expect(panel.getByTestId(`ms-price-${i}`)).toContainText("+ ");
    }
    // The jump's bot may have left the sign anywhere but Free.
    const before = await page
      .getByTestId("eo-stand")
      .getAttribute("data-price");
    expect(before).not.toBe("0");
    await panel.getByRole("radio", { name: "Price: Free" }).click();
    await expect(panel).toHaveAttribute("data-painting", "yes");
    await expect(page.getByTestId("eo-stand")).toHaveAttribute(
      "data-price",
      before ?? "2"
    );
    await expect(panel.getByTestId("ms-street-0")).toContainText("float");
    await panel.getByTestId("ms-send-3").click();
    await expect(page.getByTestId("eo-float-road")).toBeAttached();
  });

  test("the world: loudspeaker level, real and painted smiles, and the picture", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByTestId("eo-test-mode")
      .getByRole("button", { name: "Make Everyone Smile" })
      .click();
    await page.getByTestId("eo-jump-smile-2-late").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    const panel = page.getByTestId("ms-speakers");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("ms-meter")).toHaveCount(0);
    await expect(page.getByTestId("eo-world-crowd")).toBeAttached();
    for (const i of [0, 1, 2, 3, 4]) {
      await expect(panel.getByTestId(`ms-level-${i}`)).toContainText("+ ");
      await expect(panel.getByTestId(`ms-level-${i}`)).toContainText("− ");
    }
    await panel.getByRole("radio", { name: "Loudspeakers: Loudest" }).click();
    await expect(panel).toHaveAttribute("data-retuning", "yes");
    await expect(page.getByTestId("eo-world-retune")).toBeAttached();
    await expect(panel).toHaveAttribute("data-level", "4", { timeout: 20_000 });
    await expect(page.getByTestId("eo-world-waves")).toHaveAttribute(
      "data-loud",
      "4"
    );
  });

  test("Test mode on the hub opens a locked universe", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await openHub(page);
    await expect(page.getByTestId("lm-locked-grow")).toBeVisible();
    await page.getByText("Test mode: jump into any universe").click();
    await page
      .getByTestId("eo-hub-test")
      .getByRole("button", { name: "Make It Grow" })
      .click();
    await page.getByTestId("eo-jump-grow-0-late").click();
    await expect(page.getByTestId("eo-test-badge")).toHaveText("Test 1×", {
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByTestId("eo-test-exit").click();
    await expect(page.getByTestId("lm-locked-grow")).toBeVisible();
    const saved = await page.evaluate(() =>
      window.localStorage.getItem("ever-onward:save")
    );
    expect(saved ?? "").not.toContain('"grow"');
  });

  test("the Sea Chart: a finished run reveals a find and steps on", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("analytics-exclude", "1");
    });
    await openHub(page);
    await page.getByText("Test mode: jump into any universe").click();
    await page.getByTestId("eo-jump-map-light-half").click();
    const reveal = page.getByTestId("eo-map-reveal");
    await expect(reveal).toBeVisible({ timeout: 20_000 });
    const next = page.getByTestId("eo-map-reveal-continue");
    await next.click();
    await next.click();
    await expect(reveal).toHaveCount(0);
    const dialog = page.getByTestId("eo-map-dialog");
    await expect(dialog).toHaveAttribute("data-mode", "choose");
    await dialog.locator("[data-choosable]").first().click();
    await page.getByTestId("eo-map-go").click();
    await expect(dialog).toHaveCount(0);
    // The next run opens with its intro, as every new run does.
    await passCutscene(page);
    await page.getByTestId("eo-map-button").click();
    await expect(page.getByTestId("eo-map-dialog")).toHaveAttribute(
      "data-mode",
      "view"
    );
    await expect(page.getByTestId("eo-map-shelf")).toContainText("of 14");
    await page.getByRole("button", { name: "Close the map" }).click();
    await expect(page.getByTestId("eo-artifacts")).toBeAttached();
  });

  test("players without the owner mark see no Test mode", async ({ page }) => {
    await startGame(page);
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByTestId("lm-menu")).toBeVisible();
    await expect(page.getByTestId("eo-test-mode")).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId("eo-hub-test")).toHaveCount(0);
  });

  test(
    "the start screen shows first and Enter opens the hub",
    {
      tag: "@smoke",
    },
    async ({ page }) => {
      await page.goto("/ever-onward");
      await expect(page.getByTestId("eo-start")).toBeVisible();
      await expect(page.getByTestId("eo-robot")).toBeVisible();
      await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
      await expect(page.getByTestId("lm-play-light")).toHaveCount(0);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("lm-play-light")).toBeVisible();
    }
  );

  test(
    "hub loads and tapping the light earns coins",
    { tag: "@smoke" },
    async ({ page }) => {
      await openHub(page);
      await expect(
        page.getByRole("heading", { name: "Ever Onward" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Make It Grow" })
      ).toBeVisible();

      await page.getByTestId("lm-play-light").click();
      await expect(page.getByTestId("lm-phase-overlay")).toContainText(
        "The Coast"
      );
      await passCutscene(page);

      await expect(page.getByTestId("lm-hud-value")).toHaveText("0");
      await page.getByTestId("lm-tap").click();
      // The lamp's oil bill can eat a lone coin; the floating gain stays.
      await expect(page.getByText(/^\+\d+ coins$/).first()).toBeVisible();
      await expect(page.getByTestId("lm-scene")).toBeVisible();
    }
  );

  test(
    "a finished Lighthouse unlocks Make It Grow",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "ever-onward:save",
          JSON.stringify({
            version: 1,
            seenIntro: true,
            universes: {
              light: {
                run: {
                  phase: 0,
                  time: 5,
                  taps: 1,
                  complete: false,
                  resources: { coins: 0 },
                  owned: {},
                  mods: {},
                  flags: {},
                  revealed: ["lens"],
                  story: ["coast-hello"],
                  transitions: [],
                  rng: 1,
                },
                best: 1200,
                completions: 1,
                embers: 3,
                prestigeUpgrades: {},
              },
            },
          })
        );
      });
      await openHub(page);
      await expect(page.getByTestId("lm-locked-grow")).toHaveCount(0);
      await expect(page.getByTestId("lm-play-grow")).toBeVisible();
      await page.getByTestId("lm-play-grow").click();
      await expect(page.getByTestId("lm-phase-overlay")).toContainText(
        "The Backyard"
      );
      await passCutscene(page);
      await page.getByTestId("lm-tap").click();
      await expect(page.getByText(/^\+\d+(\.\d+)? \w+/).first()).toBeVisible();
      await expect(page.getByTestId("lm-scene")).toBeVisible();
    }
  );

  test("buying the first upgrade survives a reload", async ({ page }) => {
    await startGame(page);
    const lens = page
      .getByRole("region", { name: "Upgrades" })
      .getByRole("button", { name: /Better lens/ });
    await expect
      .poll(
        async () => {
          // A burst per attempt: the lamp's oil bill eats slow tapping.
          for (let i = 0; i < 30; i += 1)
            await page.getByTestId("lm-tap").click();
          return lens.getAttribute("aria-disabled");
        },
        { timeout: 60_000 }
      )
      .toBe("false");
    await lens.click();
    await expect(lens).toContainText("Level 1");

    await page.reload();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    await page.getByTestId("eo-start-button").click();
    await page.getByTestId("lm-play-light").click();
    await expect(page.getByTestId("lm-phase-overlay")).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "Upgrades" })
        .getByRole("button", { name: /Better lens/ })
    ).toContainText("Level 1");
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the coin counter bar and a tap button stay in view at the top and scrolled down", async ({
      page,
    }) => {
      await startGame(page);
      const hud = page.getByTestId("lm-hud");
      await expect(hud).toBeInViewport();

      for (let i = 0; i < 15; i += 1) await page.getByTestId("lm-tap").click();
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight)
      );

      await expect(hud).toBeInViewport();
      const value = page.getByTestId("lm-hud-value");
      await expect(value).toBeVisible();
      await expect(page.getByTestId("lm-hud-rate")).toContainText("/s");

      // Scrolled down, the bar folds to one slim row; a tap peeks at it.
      await expect(hud).toHaveAttribute("data-compact", "true");
      await expect(page.getByTestId("lm-hud-next")).toBeHidden();
      await page.getByTestId("lm-hud-toggle").click();
      await expect(page.getByTestId("lm-hud-next")).toBeVisible();

      // The tap button floats at the bottom centre and keeps earning.
      const tap = page.getByRole("button", { name: "Flash the light" });
      await expect(tap).toBeInViewport();
      await tap.click();

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(hud).toHaveAttribute("data-compact", "false");
      await expect(page.getByTestId("lm-hud-next")).toBeVisible();
      await expect(hud).toBeInViewport();
      await expect(tap).toBeInViewport();
    });

    test("the Coast never scrolls sideways, and folding the bar moves nothing", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "ever-onward:save",
          JSON.stringify({
            version: 1,
            seenIntro: true,
            universes: {
              light: {
                run: {
                  phase: 0,
                  time: 600,
                  taps: 400,
                  complete: false,
                  resources: {
                    coins: 700000,
                    oil: 22700,
                    oilPrice: 0.4,
                  },
                  owned: { lens: 5, keeper: 3, lighthouse: 4 },
                  mods: {},
                  flags: {},
                  revealed: ["lens", "keeper", "lighthouse"],
                  story: ["coast-hello"],
                  transitions: [],
                  rng: 1,
                },
                best: null,
                completions: 0,
                embers: 0,
                prestigeUpgrades: {},
              },
            },
          })
        );
      });
      await openHub(page);
      await page.getByTestId("lm-play-light").click();
      const overlay = page.getByTestId("lm-phase-overlay");
      if (await overlay.isVisible().catch(() => false))
        await passCutscene(page);
      const buy = page.getByTestId("lm-buy-oil");
      await expect(buy).toBeVisible();

      const sideways = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        );
      expect(await sideways()).toBeLessThanOrEqual(0);

      // Just above and just past the fold: the button keeps its place in the
      // page (only the bar and the scene above it shrink).
      const pageTop = () =>
        buy.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      await page.evaluate(() => window.scrollTo(0, 10));
      await expect(page.getByTestId("lm-hud")).toHaveAttribute(
        "data-compact",
        "false"
      );
      const before = await pageTop();
      await page.evaluate(() => window.scrollTo(0, 200));
      await expect(page.getByTestId("lm-hud")).toHaveAttribute(
        "data-compact",
        "true"
      );
      expect(await pageTop()).toBeCloseTo(before, 0);
      await expect(buy).toBeInViewport();
      expect(await sideways()).toBeLessThanOrEqual(0);
    });

    for (const scene of [
      {
        name: "the Coast (oil)",
        phase: 0,
        resources: { coins: 700000, oil: 22700, oilPrice: 0.4 },
        owned: { lens: 5, keeper: 3, lighthouse: 4 },
      },
      {
        name: "the night (Reservoir)",
        phase: 1,
        resources: { coins: 0, power: 76900, fund: 5000 },
        owned: { gen1: 4 },
      },
    ]) {
      test(`the folded bar's money and goal never overlap on ${scene.name}`, async ({
        page,
      }) => {
        await page.addInitScript((s) => {
          window.localStorage.setItem(
            "ever-onward:save",
            JSON.stringify({
              version: 1,
              seenIntro: true,
              universes: {
                light: {
                  run: {
                    phase: s.phase,
                    time: 1200,
                    taps: 400,
                    complete: false,
                    resources: s.resources,
                    owned: s.owned,
                    mods: {},
                    flags: {},
                    revealed: Object.keys(s.owned),
                    story: [],
                    transitions: [],
                    rng: 1,
                  },
                  best: null,
                  completions: 0,
                  embers: 0,
                  prestigeUpgrades: {},
                },
              },
            })
          );
        }, scene);
        await openHub(page);
        await page.getByTestId("lm-play-light").click();
        const overlay = page.getByTestId("lm-phase-overlay");
        if (await overlay.isVisible().catch(() => false))
          await passCutscene(page);
        await page.evaluate(() =>
          window.scrollTo(0, document.documentElement.scrollHeight)
        );
        const hud = page.getByTestId("lm-hud");
        await expect(hud).toHaveAttribute("data-compact", "true");
        const toggle = page.getByTestId("lm-hud-toggle");
        await expect(toggle).toBeVisible();
        // Let the fold's fade-in finish before measuring.
        await page.waitForTimeout(400);

        const box = (id: string) =>
          page
            .getByTestId(id)
            .evaluate((el) => el.getBoundingClientRect().toJSON());
        const value = await box("lm-hud-value");
        const rate = await box("lm-hud-rate");
        const right = await toggle.evaluate((el) => {
          // The left edge of what the toggle actually draws.
          const kids = [...el.querySelectorAll("*")].map((k) =>
            k.getBoundingClientRect()
          );
          return Math.min(...kids.map((r) => r.left));
        });
        expect(value.right).toBeLessThanOrEqual(rate.left + 0.5);
        expect(rate.right).toBeLessThanOrEqual(right);
        const viewport = page.viewportSize()!.width;
        const toggleBox = await box("lm-hud-toggle");
        expect(toggleBox.right).toBeLessThanOrEqual(viewport);
      });
    }
  });
});

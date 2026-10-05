import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/** Override to run beside another dev server (PLAYWRIGHT_PORT=3123). */
const port = process.env.PLAYWRIGHT_PORT ?? "3000";

/** The cross-browser projects run only the tests tagged @smoke. */
const smokeOnly = process.env.E2E_FULL ? undefined : /@smoke/;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  /* Software WebGL on a shared runner is slow; 30s is too tight for it. */
  timeout: 45_000,
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 2 : undefined,
  /* CI also prints each test as it finishes, so a long run shows progress. Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${port}`,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        /* On Linux, Chromium renders WebGL in software, which makes every
           click in a ship builder test wait on the 3D scene. The plain specs
           don't need it (the app shows its fallback), so CI turns it off for
           them; the WebGL specs start their own browsers. */
        launchOptions: {
          args: process.env.E2E_NO_WEBGL ? ["--disable-3d-apis"] : [],
        },
      },
    },

    /* CI does not run Firefox (pass --project=firefox to try it). */
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    /* WebKit and the iPad run only the tests tagged @smoke (touch, pointer
       and layout checks); Chromium runs everything. E2E_FULL=1 runs it all. */
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      grep: smokeOnly,
    },

    /* The Ship Builder is also a touch app, so run its tests on an iPad. */
    {
      name: "ipad",
      use: { ...devices["iPad Pro 11 landscape"] },
      testMatch: /ship-builder/,
      grep: smokeOnly,
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Test the static export (what ships), not the dev server: no on-demand
     compiling, so the 3D page is ready as soon as it is requested. */
  webServer: {
    command: `NEXT_PUBLIC_E2E=1 npm run build && npx serve out --listen ${port} --no-clipboard`,
    timeout: 180_000,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});

import { test, expect } from "@playwright/test";

test.describe("App Check", () => {
  test("e2e runs make no reCAPTCHA or App Check network calls", async ({
    page,
  }) => {
    const googleCalls: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("google.com/recaptcha") ||
        url.includes("firebaseappcheck.googleapis.com") ||
        url.includes("firestore.googleapis.com")
      ) {
        googleCalls.push(url);
      }
    });
    await page.goto("/");
    await page.goto("/plane-builder");
    await page.waitForLoadState("networkidle");
    expect(googleCalls).toEqual([]);
  });
});

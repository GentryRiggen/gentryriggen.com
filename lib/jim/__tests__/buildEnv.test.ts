export {};

/**
 * The build inlines the e2e flag and Jim's tenant even when they're unset, so
 * the test hooks compile out of the shipped build instead of staying a
 * runtime lookup.
 */

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
  jest.resetModules();
});

async function buildEnv(): Promise<Record<string, string | undefined>> {
  const mod = await import("../../../next.config");
  return (mod.default.env ?? {}) as Record<string, string | undefined>;
}

it('inlines NEXT_PUBLIC_E2E as "0" and the tenant as "" when unset', async () => {
  delete process.env.NEXT_PUBLIC_E2E;
  delete process.env.NEXT_PUBLIC_JIM_TENANT;
  const env = await buildEnv();
  expect(env.NEXT_PUBLIC_E2E).toBe("0");
  expect(env.NEXT_PUBLIC_JIM_TENANT).toBe("");
  expect(env.NEXT_PUBLIC_BUILD_ID).toBeTruthy();
});

it("passes the e2e flag and the tenant through when set", async () => {
  process.env.NEXT_PUBLIC_E2E = "1";
  process.env.NEXT_PUBLIC_JIM_TENANT = "jim-tenant-test";
  const env = await buildEnv();
  expect(env.NEXT_PUBLIC_E2E).toBe("1");
  expect(env.NEXT_PUBLIC_JIM_TENANT).toBe("jim-tenant-test");
});

import { versionRoute } from "../versionRoute";

// jsdom has no Response; a stand-in with Response.json's shape is enough.
class FakeResponse {
  constructor(
    private body: unknown,
    readonly headers: Headers
  ) {}
  static json(body: unknown, init?: { headers?: Record<string, string> }) {
    return new FakeResponse(body, new Headers(init?.headers));
  }
  json() {
    return Promise.resolve(this.body);
  }
}

describe("versionRoute", () => {
  const original = globalThis.Response;
  beforeAll(() => {
    (globalThis as unknown as { Response: unknown }).Response = FakeResponse;
  });
  afterAll(() => {
    globalThis.Response = original;
  });

  it("answers with the version, the build and no-cache", async () => {
    const response = versionRoute("2.3.4")();
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(await response.json()).toEqual({
      version: "2.3.4",
      build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev",
    });
  });
});

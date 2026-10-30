import {
  describeOutcome,
  shareImage,
  shareText,
  type ShareEnvironment,
} from "../shareImage";

const blob = new Blob(["png"], { type: "image/png" });
const payload = {
  blob,
  filename: "ship.png",
  title: "My ship",
  text: "Look at my ship!",
  url: "https://example.com/ship-builder#ship=abc",
};

function makeEnv(overrides: Partial<ShareEnvironment> = {}) {
  const share = jest.fn().mockResolvedValue(undefined);
  const env = {
    share,
    canShare: jest.fn().mockReturnValue(true),
    copyText: jest.fn().mockResolvedValue(true),
    download: jest.fn(),
    ...overrides,
  };
  return { ...env, shareMock: share };
}

describe("shareText", () => {
  it("adds the link after the text", () => {
    expect(shareText("Hi", "https://x.test")).toBe("Hi https://x.test");
  });
  it("is just the text with no link", () => {
    expect(shareText("Hi")).toBe("Hi");
  });
});

describe("shareImage", () => {
  it("shares the picture as a file with the link in the text", async () => {
    const env = makeEnv();
    const outcome = await shareImage(payload, env);
    expect(outcome).toEqual({ kind: "shared" });
    const data = env.shareMock.mock.calls[0][0] as ShareData;
    expect(data.files?.[0].name).toBe("ship.png");
    expect(data.text).toContain(payload.url);
    expect(env.download).not.toHaveBeenCalled();
  });

  it("reports a cancelled share without saving anything", async () => {
    const env = makeEnv({
      share: jest.fn().mockRejectedValue(new DOMException("x", "AbortError")),
    });
    expect(await shareImage(payload, env)).toEqual({ kind: "cancelled" });
    expect(env.download).not.toHaveBeenCalled();
  });

  it("downloads the picture and copies the link when files cannot be shared", async () => {
    const env = makeEnv({ canShare: jest.fn().mockReturnValue(false) });
    const outcome = await shareImage(payload, env);
    expect(outcome).toEqual({ kind: "saved", isLinkCopied: true });
    expect(env.download).toHaveBeenCalledWith(blob, "ship.png");
    expect(env.copyText).toHaveBeenCalledWith(payload.url);
  });

  it("downloads when there is no share function at all", async () => {
    const env = makeEnv({ share: undefined, canShare: undefined });
    expect(await shareImage(payload, env)).toEqual({
      kind: "saved",
      isLinkCopied: true,
    });
  });

  it("falls back to saving when the share sheet fails for another reason", async () => {
    const env = makeEnv({
      share: jest.fn().mockRejectedValue(new Error("boom")),
    });
    const outcome = await shareImage(payload, env);
    expect(outcome.kind).toBe("saved");
    expect(env.download).toHaveBeenCalled();
  });

  it("copies no link when there is none", async () => {
    const env = makeEnv({ canShare: jest.fn().mockReturnValue(false) });
    const outcome = await shareImage({ ...payload, url: undefined }, env);
    expect(outcome).toEqual({ kind: "saved", isLinkCopied: false });
    expect(env.copyText).not.toHaveBeenCalled();
  });

  it("says the link was not copied when the clipboard is blocked", async () => {
    const env = makeEnv({
      canShare: jest.fn().mockReturnValue(false),
      copyText: jest.fn().mockResolvedValue(false),
    });
    expect(await shareImage(payload, env)).toEqual({
      kind: "saved",
      isLinkCopied: false,
    });
  });

  it("fails when the download itself throws", async () => {
    const env = makeEnv({
      canShare: jest.fn().mockReturnValue(false),
      download: jest.fn(() => {
        throw new Error("no");
      }),
    });
    expect(await shareImage(payload, env)).toEqual({ kind: "failed" });
  });
});

describe("describeOutcome", () => {
  it("has plain words for each outcome", () => {
    expect(describeOutcome({ kind: "shared" })).toBe("Shared!");
    expect(describeOutcome({ kind: "cancelled" })).toBe("");
    expect(describeOutcome({ kind: "saved", isLinkCopied: true })).toBe(
      "Picture saved and link copied"
    );
    expect(describeOutcome({ kind: "saved", isLinkCopied: false })).toBe(
      "Picture saved"
    );
    expect(describeOutcome({ kind: "failed" })).toMatch(/couldn't/i);
  });
});

import { shareOrDownload } from "../shareImage";

const blob = new Blob(["png"], { type: "image/png" });

function setShare(share: unknown, canShare: unknown = () => true) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: canShare,
  });
}

beforeEach(() => {
  URL.createObjectURL = jest.fn(() => "blob:x");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(navigator, "share");
  Reflect.deleteProperty(navigator, "canShare");
});

describe("shareOrDownload", () => {
  it("hands the file to the share sheet when it can", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setShare(share);
    await expect(shareOrDownload(blob)).resolves.toBe("share");
    const { files } = share.mock.calls[0][0] as { files: File[] };
    expect(files[0].name).toBe("my-flameling.png");
    expect(files[0].type).toBe("image/png");
  });

  it("downloads when there is no share sheet", async () => {
    await expect(shareOrDownload(blob)).resolves.toBe("download");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it("downloads when the sheet cannot take files", async () => {
    setShare(jest.fn(), () => false);
    await expect(shareOrDownload(blob)).resolves.toBe("download");
  });

  it("treats closing the sheet as cancelled, not a download", async () => {
    setShare(jest.fn().mockRejectedValue(new DOMException("x", "AbortError")));
    await expect(shareOrDownload(blob)).resolves.toBe("cancelled");
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });

  it("falls back to a download when the sheet fails", async () => {
    setShare(
      jest.fn().mockRejectedValue(new DOMException("x", "NotAllowedError"))
    );
    await expect(shareOrDownload(blob)).resolves.toBe("download");
  });
});

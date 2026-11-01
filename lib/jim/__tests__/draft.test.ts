import { clearDraft, loadDraft, saveDraft } from "../draft";

beforeEach(() => window.sessionStorage.clear());

describe("draft", () => {
  it("round-trips per user and clears", () => {
    saveDraft("u1", "half a thought");
    expect(window.sessionStorage.getItem("jim:draft:u1")).toBe(
      "half a thought"
    );
    expect(loadDraft("u1")).toBe("half a thought");
    expect(loadDraft("u2")).toBe("");
    clearDraft("u1");
    expect(loadDraft("u1")).toBe("");
  });

  it("saving an empty draft removes it", () => {
    saveDraft("u1", "x");
    saveDraft("u1", "");
    expect(loadDraft("u1")).toBe("");
  });

  it("never throws when storage does", () => {
    const boom = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(loadDraft("u1")).toBe("");
    boom.mockRestore();
  });
});

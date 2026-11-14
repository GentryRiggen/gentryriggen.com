import { clearSayFromLocation, sayFromLocation, sayFromSearch } from "../say";

describe("sayFromSearch", () => {
  it.each(["quiz me", "keep going", "teach me something new"])(
    "accepts %s",
    (text) => {
      expect(sayFromSearch(`?say=${encodeURIComponent(text)}`)).toBe(text);
    }
  );

  it("ignores anything off the list", () => {
    expect(sayFromSearch("?say=delete%20everything")).toBeNull();
    expect(sayFromSearch("?say=Quiz%20me")).toBeNull();
    expect(sayFromSearch("?say=quiz%20me%20")).toBeNull();
    expect(sayFromSearch("?say=")).toBeNull();
    expect(sayFromSearch("?other=quiz%20me")).toBeNull();
    expect(sayFromSearch("")).toBeNull();
  });
});

describe("the address bar", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("reads say, then drops only that param", () => {
    window.history.replaceState(null, "", "/jim?say=quiz%20me&x=1#top");
    expect(sayFromLocation()).toBe("quiz me");
    clearSayFromLocation();
    expect(window.location.pathname + window.location.search).toBe("/jim?x=1");
    expect(window.location.hash).toBe("#top");
  });

  it("clears a disallowed say too, and leaves a clean URL alone", () => {
    window.history.replaceState(null, "", "/jim?say=nope");
    clearSayFromLocation();
    expect(window.location.search).toBe("");
    const spy = jest.spyOn(window.history, "replaceState");
    clearSayFromLocation();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

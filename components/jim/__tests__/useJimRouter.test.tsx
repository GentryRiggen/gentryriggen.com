import { act, renderHook } from "@testing-library/react";
import useJimRouter, {
  isPlainClick,
  replaceWithJimHome,
} from "../useJimRouter";

beforeEach(() => {
  window.history.replaceState(null, "", "/jim/notes/people");
});

function popTo() {
  return new Promise<void>((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
  });
}

it("reads the route from the address and marks the entry it opened on", () => {
  const { result } = renderHook(() => useJimRouter());
  expect(result.current.location.route).toEqual({
    kind: "page",
    page: "people",
  });
  expect(result.current.location.depth).toBe(0);
  expect(window.history.state.jim.key).toBe(result.current.location.key);
});

it("pushes an entry per page, and pops back to it", async () => {
  const { result } = renderHook(() => useJimRouter());
  const listKey = result.current.location.key;
  act(() =>
    result.current.navigate(
      { kind: "person", slug: "sam-okafor" },
      { back: "People" }
    )
  );
  expect(window.location.pathname).toBe("/jim/notes/people/sam-okafor");
  expect(result.current.location).toMatchObject({
    route: { kind: "person", slug: "sam-okafor" },
    depth: 1,
    back: "People",
    from: "/jim/notes/people",
    nav: "push",
  });

  const popped = popTo();
  act(() => window.history.back());
  await act(async () => popped);
  expect(result.current.location).toMatchObject({
    route: { kind: "page", page: "people" },
    key: listKey,
    nav: "pop",
  });
});

it("doesn't stack the page already showing", () => {
  const { result } = renderHook(() => useJimRouter());
  const before = window.history.length;
  act(() => result.current.navigate({ kind: "page", page: "people" }));
  expect(window.history.length).toBe(before);
});

it("goes up to the list when the profile was opened from its address", () => {
  window.history.replaceState(null, "", "/jim/notes/people/sam-okafor");
  const { result } = renderHook(() => useJimRouter());
  const before = window.history.length;
  act(() => result.current.goBack({ kind: "page", page: "people" }));
  expect(window.location.pathname).toBe("/jim/notes/people");
  // Replaced, not pushed: Back doesn't return to the profile.
  expect(window.history.length).toBe(before);
});

it("goes back in history when this page pushed the entry", async () => {
  const { result } = renderHook(() => useJimRouter());
  act(() => result.current.navigate({ kind: "person", slug: "sam-okafor" }));
  const popped = popTo();
  act(() => result.current.goBack({ kind: "page", page: "people" }));
  await act(async () => popped);
  expect(window.location.pathname).toBe("/jim/notes/people");
});

it("keeps a note with an unusual name in the entry, not the address", () => {
  const { result } = renderHook(() => useJimRouter());
  act(() => result.current.navigate({ kind: "note", path: "INDEX" }));
  expect(window.location.pathname).toBe("/jim/notes/note");
  expect(result.current.location.route).toEqual({
    kind: "note",
    path: "INDEX",
  });
});

it("leaves ⌘-, Ctrl-, Shift- and middle clicks to the browser", () => {
  const plain = {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
  };
  expect(isPlainClick(plain)).toBe(true);
  expect(isPlainClick({ ...plain, metaKey: true })).toBe(false);
  expect(isPlainClick({ ...plain, ctrlKey: true })).toBe(false);
  expect(isPlainClick({ ...plain, shiftKey: true })).toBe(false);
  expect(isPlainClick({ ...plain, button: 1 })).toBe(false);
  expect(isPlainClick({ ...plain, defaultPrevented: true })).toBe(false);
});

describe("with Next's history patch", () => {
  const push = window.history.pushState;
  const replace = window.history.replaceState;
  /** Calls Next saw without its fields, so it synced its own URL too. */
  let synced: string[] = [];

  beforeEach(() => {
    synced = [];
    // As Next's App Router patches them: data that already has __NA is
    // passed straight through (Next doesn't sync); anything else gets
    // Next's fields copied in, and Next adopts the URL.
    function patch(original: History["pushState"]) {
      return function (
        this: History,
        data: Record<string, unknown> | null,
        unused: string,
        url?: string | URL | null
      ) {
        if (data?.__NA) return original.call(this, data, unused, url);
        const next = { ...(data ?? {}) };
        const current = window.history.state as Record<string, unknown> | null;
        if (current?.__NA) next.__NA = current.__NA;
        if (url) synced.push(String(url));
        return original.call(this, next, unused, url);
      };
    }
    window.history.replaceState(
      { __NA: true, lib: "kept" },
      "",
      "/jim/notes/people"
    );
    window.history.pushState = patch(push) as History["pushState"];
    window.history.replaceState = patch(replace) as History["replaceState"];
  });

  afterEach(() => {
    window.history.pushState = push;
    window.history.replaceState = replace;
  });

  it("keeps Next's fields and others' on every entry, and lets Next sync", async () => {
    const { result } = renderHook(() => useJimRouter());
    // The opening entry, marked in place: other fields kept.
    expect(window.history.state).toMatchObject({ __NA: true, lib: "kept" });
    act(() => result.current.navigate({ kind: "person", slug: "sam-okafor" }));
    expect(window.history.state).toMatchObject({ __NA: true });
    expect(synced).toContain("/jim/notes/people/sam-okafor");
    const popped = popTo();
    act(() => window.history.back());
    await act(async () => popped);
    // The Back entry still belongs to Next (no reload on popstate).
    expect(window.history.state).toMatchObject({ __NA: true, lib: "kept" });
  });

  it("sign-out puts /jim in the address, and Next takes it too", () => {
    renderHook(() => useJimRouter());
    act(() => replaceWithJimHome());
    expect(window.location.pathname).toBe("/jim");
    expect(synced).toContain("/jim");
    expect(window.history.state).toMatchObject({ __NA: true });
  });
});

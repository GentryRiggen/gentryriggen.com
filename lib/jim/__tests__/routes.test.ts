import {
  formatJimPath,
  homePageOf,
  isRoutableNotePath,
  isSafeNotePath,
  parseJimPath,
  routeForNote,
  routeTitle,
  sameRoute,
  type JimRoute,
} from "@/lib/jim/routes";

describe("parseJimPath", () => {
  it.each<[string, JimRoute]>([
    ["/jim", { kind: "chat" }],
    ["/jim/", { kind: "chat" }],
    ["/jim.html", { kind: "chat" }],
    ["/jim/chat", { kind: "chat" }],
    ["/jim/notes", { kind: "page", page: "home" }],
    ["/jim/notes/", { kind: "page", page: "home" }],
    ["/jim/notes/work", { kind: "page", page: "work" }],
    ["/jim/notes/money", { kind: "page", page: "money" }],
    ["/jim/notes/people", { kind: "page", page: "people" }],
    ["/jim/notes/health", { kind: "page", page: "health" }],
    ["/jim/notes/training", { kind: "page", page: "training" }],
    ["/jim/notes/golf", { kind: "page", page: "golf" }],
    [
      "/jim/notes/people/andrew-jenkins",
      { kind: "person", slug: "andrew-jenkins" },
    ],
    ["/jim/notes/directory/42", { kind: "directory", id: 42 }],
    [
      "/jim/notes/note/work/burns-intelligence",
      { kind: "note", path: "work/burns-intelligence" },
    ],
    [
      "/jim/notes/note/meetings/2026-10-30-tech-l10",
      { kind: "note", path: "meetings/2026-10-30-tech-l10" },
    ],
  ])("%s", (path, route) => {
    expect(parseJimPath(path)).toEqual(route);
  });

  it.each([
    "/",
    "/jimmy",
    "/jim/nope",
    "/jim/chat/extra",
    "/jim/notes/home",
    "/jim/notes/nope",
    "/jim/notes/people/Andrew",
    "/jim/notes/people/a/b",
    "/jim/notes/people/a.b",
    "/jim/notes/directory/x",
    "/jim/notes/directory/1234567",
    "/jim/notes/note",
    "/jim/notes/note/../secrets",
    "/jim/notes/note/work/..",
    "/jim/notes/note/work//x",
    "/jim/notes/note/work/x.md",
    "/jim/notes/note/Work/x",
    "/jim/notes/note/work/%2e%2e",
    "/jim/notes/note/work/a_b",
    `/jim/notes/note/${"a/".repeat(9)}a`,
  ])("%s is not found", (path) => {
    expect(parseJimPath(path)).toEqual({ kind: "notFound" });
  });

  it("takes a note with an unusual name from its history entry, if safe", () => {
    expect(parseJimPath("/jim/notes/note", "INDEX")).toEqual({
      kind: "note",
      path: "INDEX",
    });
    expect(parseJimPath("/jim/notes/note", "../etc/passwd")).toEqual({
      kind: "notFound",
    });
    expect(parseJimPath("/jim/notes/note", 7)).toEqual({ kind: "notFound" });
  });
});

describe("formatJimPath", () => {
  it.each<JimRoute>([
    { kind: "chat" },
    { kind: "page", page: "home" },
    { kind: "page", page: "training" },
    { kind: "person", slug: "sam-okafor" },
    { kind: "directory", id: 7 },
    { kind: "note", path: "home/garden" },
  ])("round-trips %j", (route) => {
    expect(parseJimPath(formatJimPath(route))).toEqual(route);
  });

  it("keeps an unusual note name out of the address", () => {
    expect(formatJimPath({ kind: "note", path: "INDEX" })).toBe(
      "/jim/notes/note"
    );
  });
});

describe("note paths", () => {
  it("only lowercase segments sit in the address", () => {
    expect(isRoutableNotePath("work/burns-intelligence")).toBe(true);
    expect(isRoutableNotePath("work/Burns")).toBe(false);
    expect(isRoutableNotePath("")).toBe(false);
    expect(isRoutableNotePath("/work")).toBe(false);
  });

  it("never lets .. or a leading slash through", () => {
    expect(isSafeNotePath("notes/2026_q4")).toBe(true);
    expect(isSafeNotePath("../x")).toBe(false);
    expect(isSafeNotePath("a/../x")).toBe(false);
    expect(isSafeNotePath("a/..x")).toBe(false);
    expect(isSafeNotePath("/abs")).toBe(false);
    expect(isSafeNotePath("a\\b")).toBe(false);
  });

  it("opens a people note as the person, anything else as a note", () => {
    expect(routeForNote("people/sam-okafor.md")).toEqual({
      kind: "person",
      slug: "sam-okafor",
    });
    expect(routeForNote("home/garden.md")).toEqual({
      kind: "note",
      path: "home/garden",
    });
    expect(routeForNote("../x.md")).toBeNull();
  });
});

describe("routeTitle", () => {
  it("names the page for the browser tab", () => {
    expect(routeTitle({ kind: "chat" })).toBe("Chat · Jim");
    expect(routeTitle({ kind: "page", page: "people" })).toBe("People · Jim");
    expect(routeTitle({ kind: "person", slug: "a" }, "Andrew Jenkins")).toBe(
      "Andrew Jenkins · Jim"
    );
    expect(routeTitle({ kind: "person", slug: "a" })).toBe("People · Jim");
    expect(routeTitle({ kind: "note", path: "x" }, "Garden")).toBe(
      "Garden · Jim"
    );
    expect(routeTitle({ kind: "notFound" })).toBe("Not found · Jim");
  });
});

it("puts a page opened from its address under the list it belongs to", () => {
  expect(homePageOf({ kind: "person", slug: "a" })).toBe("people");
  expect(homePageOf({ kind: "directory", id: 1 })).toBe("work");
  expect(homePageOf({ kind: "note", path: "meetings/x" })).toBe("work");
  expect(homePageOf({ kind: "note", path: "home/garden" })).toBe("home");
  expect(homePageOf({ kind: "page", page: "golf" })).toBe("golf");
});

describe("reminder and meeting routes", () => {
  it("parses a reminder list, a reminder and a meeting", () => {
    expect(parseJimPath("/jim/reminders")).toEqual({ kind: "reminders" });
    expect(parseJimPath("/jim/reminders/abcdef012345")).toEqual({
      kind: "reminder",
      id: "abcdef012345",
    });
    expect(parseJimPath("/jim/meeting/0123456789abcdef")).toEqual({
      kind: "meeting",
      id: "0123456789abcdef",
    });
  });

  it.each([
    "/jim/reminders/ABC",
    "/jim/reminders/abcdef01234",
    "/jim/reminders/abcdef0123456",
    "/jim/reminders/abcdef012345/more",
    "/jim/meeting",
    "/jim/meeting/abcdef012345",
    "/jim/meeting/0123456789ABCDEF",
    "/jim/meeting/0123456789abcdef/x",
  ])("%s is not found", (path) => {
    expect(parseJimPath(path)).toEqual({ kind: "notFound" });
  });

  it("round-trips through formatJimPath", () => {
    const routes: JimRoute[] = [
      { kind: "reminders" },
      { kind: "reminder", id: "abcdef012345" },
      { kind: "meeting", id: "0123456789abcdef" },
    ];
    for (const route of routes) {
      expect(parseJimPath(formatJimPath(route))).toEqual(route);
    }
  });

  it("tells reminders and meetings apart in sameRoute", () => {
    expect(
      sameRoute(
        { kind: "reminder", id: "abcdef012345" },
        { kind: "reminder", id: "abcdef012346" }
      )
    ).toBe(false);
    expect(sameRoute({ kind: "reminders" }, { kind: "reminders" })).toBe(true);
  });
});

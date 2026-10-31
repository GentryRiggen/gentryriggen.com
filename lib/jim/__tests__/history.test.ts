import {
  clearHistory,
  HISTORY_LIMIT,
  historyKey,
  loadHistory,
  saveHistory,
  type ChatMessage,
} from "../history";

beforeEach(() => window.localStorage.clear());

const UID = "uid-1";

it("keeps the session and messages per signed-in user", () => {
  const messages: ChatMessage[] = [
    { id: 0, from: "me", text: "what's on my list?" },
    { id: 1, from: "jim", text: "Two things.", changed: ["lists/todos.md"] },
  ];
  saveHistory(UID, { session: "s-1", messages });
  expect(historyKey(UID)).toBe("jim:chat:uid-1");
  expect(window.localStorage.getItem("jim:chat:uid-1")).not.toBeNull();
  expect(loadHistory(UID)).toEqual({ session: "s-1", messages });
  expect(loadHistory("someone-else")).toBeNull();
});

it("keeps only the last 100 messages", () => {
  const messages: ChatMessage[] = Array.from({ length: 130 }, (_, i) => ({
    id: i,
    from: i % 2 ? "jim" : "me",
    text: `m${i}`,
  }));
  saveHistory(UID, { session: "s", messages });
  const back = loadHistory(UID)!.messages;
  expect(HISTORY_LIMIT).toBe(100);
  expect(back).toHaveLength(100);
  expect(back[0].text).toBe("m30");
  expect(back[99].text).toBe("m129");
});

it("never stores a message as still waiting: it comes back uncertain", () => {
  saveHistory(UID, {
    session: "s",
    messages: [
      { id: 0, from: "me", text: "remember the milk", pending: true },
      { id: 1, from: "jim", text: "Saving", pending: true },
      { id: 2, from: "jim", text: "", pending: true },
    ],
  });
  expect(loadHistory(UID)!.messages).toEqual([
    { id: 0, from: "me", text: "remember the milk", uncertain: true },
    { id: 1, from: "jim", text: "Saving", uncertain: true },
  ]);
});

it("ignores what it can't read", () => {
  window.localStorage.setItem(historyKey(UID), "{nope");
  expect(loadHistory(UID)).toBeNull();
  window.localStorage.setItem(
    historyKey(UID),
    JSON.stringify({ session: "s", messages: [{ id: 0, from: "x", text: 1 }] })
  );
  expect(loadHistory(UID)).toEqual({ session: "s", messages: [] });
  window.localStorage.setItem(
    historyKey(UID),
    JSON.stringify({ messages: [] })
  );
  expect(loadHistory(UID)).toBeNull();
});

it("wipes one user's chat, or every chat on the device", () => {
  saveHistory(UID, { session: "s", messages: [] });
  saveHistory("uid-2", { session: "t", messages: [] });
  window.localStorage.setItem("analytics-exclude", "1");
  clearHistory(UID);
  expect(loadHistory(UID)).toBeNull();
  expect(loadHistory("uid-2")).not.toBeNull();
  clearHistory();
  expect(loadHistory("uid-2")).toBeNull();
  expect(window.localStorage.getItem("analytics-exclude")).toBe("1");
});

it("does nothing when storage is blocked", () => {
  const spy = jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
  try {
    expect(() =>
      saveHistory(UID, { session: "s", messages: [] })
    ).not.toThrow();
  } finally {
    spy.mockRestore();
  }
});

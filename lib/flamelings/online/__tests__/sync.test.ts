import { createPet } from "../../actions";
import { cardOf } from "../card";
import { CardSync, MIN_SYNC_INTERVAL_MS } from "../sync";
import * as client from "../client";

jest.mock("../client", () => ({ updateCard: jest.fn() }));
const updateCard = client.updateCard as jest.Mock;

const look = { colour: "ember", shape: "flame", eyes: "round" } as const;
const base = createPet({ id: "p", name: "Pip", look, now: 0 });
const withCode = (patch = {}) => ({
  ...base,
  ...patch,
  online: { ...base.online, code: "ABCDEF" },
});

let nowMs = 1_000_000;
beforeEach(() => {
  jest.useFakeTimers();
  updateCard.mockReset().mockResolvedValue("ok");
  nowMs = 1_000_000;
});
afterEach(() => jest.useRealTimers());

const make = () =>
  new CardSync(
    () => ({}),
    () => nowMs
  );

describe("CardSync", () => {
  it("sends nothing for a pet without a code", () => {
    const sync = make();
    sync.observe([base]);
    jest.advanceTimersByTime(60_000);
    expect(updateCard).not.toHaveBeenCalled();
  });

  it("does not resend a card that has not changed since it was created", () => {
    const sync = make();
    sync.created("ABCDEF", cardOf(withCode()));
    sync.observe([withCode()]);
    jest.advanceTimersByTime(60_000);
    expect(updateCard).not.toHaveBeenCalled();
  });

  it("waits out the minimum interval after a create before sending a change", async () => {
    const sync = make();
    sync.created("ABCDEF", cardOf(withCode()));
    sync.observe([withCode({ level: 2 })]);
    jest.advanceTimersByTime(MIN_SYNC_INTERVAL_MS - 1);
    expect(updateCard).not.toHaveBeenCalled();
    nowMs += MIN_SYNC_INTERVAL_MS;
    jest.advanceTimersByTime(1);
    expect(updateCard).toHaveBeenCalledTimes(1);
    expect(updateCard.mock.calls[0][1].level).toBe(2);
  });

  it("coalesces quick changes into one write with the latest card", () => {
    const sync = make();
    sync.created("ABCDEF", cardOf(withCode()));
    sync.observe([withCode({ level: 2 })]);
    sync.observe([withCode({ level: 3 })]);
    sync.observe([withCode({ level: 4 })]);
    nowMs += MIN_SYNC_INTERVAL_MS;
    jest.advanceTimersByTime(MIN_SYNC_INTERVAL_MS);
    expect(updateCard).toHaveBeenCalledTimes(1);
    expect(updateCard.mock.calls[0][1].level).toBe(4);
  });

  it("spaces consecutive writes at least the interval apart", async () => {
    const sync = make();
    sync.observe([withCode({ level: 2 })]);
    jest.advanceTimersByTime(0);
    await Promise.resolve();
    expect(updateCard).toHaveBeenCalledTimes(1);
    sync.observe([withCode({ level: 3 })]);
    jest.advanceTimersByTime(MIN_SYNC_INTERVAL_MS - 1);
    expect(updateCard).toHaveBeenCalledTimes(1);
    nowMs += MIN_SYNC_INTERVAL_MS;
    jest.advanceTimersByTime(1);
    expect(updateCard).toHaveBeenCalledTimes(2);
  });

  it("tries again after a failed write", async () => {
    updateCard.mockResolvedValueOnce("error");
    const sync = make();
    sync.observe([withCode({ level: 2 })]);
    jest.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();
    sync.observe([withCode({ level: 2 })]);
    nowMs += MIN_SYNC_INTERVAL_MS;
    jest.advanceTimersByTime(MIN_SYNC_INTERVAL_MS);
    expect(updateCard).toHaveBeenCalledTimes(2);
  });

  it("dispose cancels a waiting write", () => {
    const sync = make();
    sync.created("ABCDEF", cardOf(withCode()));
    sync.observe([withCode({ level: 2 })]);
    sync.dispose();
    jest.advanceTimersByTime(60_000);
    expect(updateCard).not.toHaveBeenCalled();
  });
});

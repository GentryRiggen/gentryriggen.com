import { act, renderHook } from "@testing-library/react";
import { startSwimming, type EscapePhase } from "../../walk/escape";
import {
  getEscape,
  publishEscape,
  resetEscape,
  subscribeEscape,
  useEscape,
  type EscapeSnapshot,
} from "../escapeLive";

const swimming = (x: number, warned = false): EscapeSnapshot => {
  const phase = startSwimming({ x, z: 0 }, 0, 5) as Extract<
    EscapePhase,
    { kind: "swimming" }
  >;
  return { phase: { ...phase, warned }, boardable: null, pickup: null };
};

beforeEach(() => {
  resetEscape();
});

describe("escapeLive", () => {
  it("starts aboard with nothing to board or climb into", () => {
    expect(getEscape()).toEqual({
      phase: { kind: "aboard" },
      boardable: null,
      pickup: null,
    });
  });

  it("publishes a new phase to subscribers", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeEscape(listener);
    publishEscape(swimming(1));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getEscape().phase.kind).toBe("swimming");
    unsubscribe();
    publishEscape({ phase: { kind: "aboard" }, boardable: null, pickup: null });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the latest swimmer without telling anyone when only it moved", () => {
    publishEscape(swimming(1));
    const listener = jest.fn();
    subscribeEscape(listener);
    publishEscape(swimming(2));
    publishEscape(swimming(3));
    expect(listener).not.toHaveBeenCalled();
    const { phase } = getEscape();
    expect(phase.kind === "swimming" && phase.swimmer.x).toBe(3);
  });

  it("tells subscribers when the cold warning, a boat to board or a pickup appears", () => {
    publishEscape(swimming(1));
    const listener = jest.fn();
    subscribeEscape(listener);
    publishEscape(swimming(1, true));
    expect(listener).toHaveBeenCalledTimes(1);
    publishEscape({ ...swimming(1, true), pickup: { boatId: "b1" } });
    expect(listener).toHaveBeenCalledTimes(2);
    publishEscape({ ...swimming(1, true), pickup: { boatId: "b2" } });
    expect(listener).toHaveBeenCalledTimes(3);
    publishEscape({
      phase: { kind: "aboard" },
      boardable: { boatId: "b1", kind: "raft" },
      pickup: null,
    });
    expect(listener).toHaveBeenCalledTimes(4);
    publishEscape({
      phase: { kind: "aboard" },
      boardable: { boatId: "b1", kind: "raft" },
      pickup: null,
    });
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("resets to aboard and tells subscribers", () => {
    publishEscape(swimming(1));
    const listener = jest.fn();
    subscribeEscape(listener);
    resetEscape();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getEscape()).toEqual({
      phase: { kind: "aboard" },
      boardable: null,
      pickup: null,
    });
  });

  it("re-renders a hook user only on a meaningful change", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useEscape();
    });
    expect(result.current.phase.kind).toBe("aboard");
    act(() => publishEscape(swimming(1)));
    expect(result.current.phase.kind).toBe("swimming");
    const after = renders;
    act(() => {
      publishEscape(swimming(2));
      publishEscape(swimming(3));
    });
    expect(renders).toBe(after);
    act(() => resetEscape());
    expect(result.current.phase.kind).toBe("aboard");
  });
});

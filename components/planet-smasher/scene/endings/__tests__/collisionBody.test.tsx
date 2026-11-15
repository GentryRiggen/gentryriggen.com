import { renderHook } from "@testing-library/react";
import { collisionBody, useBodyMaterial } from "../collisionBody";

jest.mock("../../planetTextures", () => ({
  loadPlanetTextures: () => new Promise(() => {}),
}));

describe("collisionBody", () => {
  it("sends Mars at Earth", () => {
    expect(collisionBody("earth")).toBe("mars");
  });

  it("sends Earth at everyone else", () => {
    expect(collisionBody("mars")).toBe("earth");
    expect(collisionBody("ice")).toBe("earth");
  });
});

describe("useBodyMaterial", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shares one material per planet and disposes it after the last user", () => {
    const a = renderHook(() => useBodyMaterial("mars"));
    const b = renderHook(() => useBodyMaterial("mars"));
    expect(a.result.current).toBe(b.result.current);
    const spy = jest.spyOn(a.result.current, "dispose");
    a.unmount();
    jest.advanceTimersByTime(5000);
    expect(spy).not.toHaveBeenCalled();
    b.unmount();
    jest.advanceTimersByTime(5000);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("keeps the material when a new user arrives during the hand-over", () => {
    const a = renderHook(() => useBodyMaterial("ice"));
    const material = a.result.current;
    const spy = jest.spyOn(material, "dispose");
    a.unmount();
    const b = renderHook(() => useBodyMaterial("ice"));
    jest.advanceTimersByTime(5000);
    expect(b.result.current).toBe(material);
    expect(spy).not.toHaveBeenCalled();
    b.unmount();
  });
});

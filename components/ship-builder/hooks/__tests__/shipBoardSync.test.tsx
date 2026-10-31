import { act, renderHook } from "@testing-library/react";
import {
  challengeProgress,
  recordChallengeBest,
} from "@/lib/ship-builder/challenges/progressStore";
import {
  noteShipSeason,
  resetShipSeasonForTests,
  useShipSeason,
} from "../shipBoardSync";

beforeEach(() => {
  localStorage.clear();
  challengeProgress.resetMemory();
  resetShipSeasonForTests();
});

describe("useShipSeason", () => {
  it("is unknown until the season is read", () => {
    const { result } = renderHook(() => useShipSeason());
    expect(result.current.current).toBeNull();
    expect(result.current.isNewSeason).toBe(false);
  });

  it("shows the season read, and a new one for a player with stars", () => {
    recordChallengeBest("a", "outlast", 1440);
    const { result } = renderHook(() => useShipSeason());
    act(() => noteShipSeason(2));
    expect(result.current.current).toBe(2);
    expect(result.current.isNewSeason).toBe(true);
    expect(challengeProgress.get().season).toEqual({ number: 2, designs: {} });
    act(() => result.current.dismissNewSeason());
    expect(result.current.isNewSeason).toBe(false);
  });

  it("keeps the note across a reload until dismissed", () => {
    recordChallengeBest("a", "outlast", 1440);
    noteShipSeason(2);
    resetShipSeasonForTests({ keepNote: true });
    const { result } = renderHook(() => useShipSeason());
    expect(result.current.isNewSeason).toBe(true);
    // The same season read again resets nothing more.
    act(() => noteShipSeason(2));
    expect(result.current.isNewSeason).toBe(true);
  });

  it("no note for season 1, the board from before seasons", () => {
    recordChallengeBest("a", "outlast", 1440);
    const { result } = renderHook(() => useShipSeason());
    act(() => noteShipSeason(1));
    expect(result.current.current).toBe(1);
    expect(result.current.isNewSeason).toBe(false);
  });

  it("no note for a player with no stars", () => {
    const { result } = renderHook(() => useShipSeason());
    act(() => noteShipSeason(2));
    expect(result.current.current).toBe(2);
    expect(result.current.isNewSeason).toBe(false);
  });
});

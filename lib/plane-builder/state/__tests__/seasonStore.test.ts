import { newProgress, startSeason } from "../../economy/progress";
import { usePlaneBuilderStore as store } from "../store";

beforeEach(() => store.setState(store.getInitialState(), true));

const played = () => ({
  ...newProgress(),
  lifetimeDistance: 5000,
  season: { ...newProgress().season, number: 2, distance: 3000 },
});

describe("seasons in the store", () => {
  it("starts with no season read and no note", () => {
    expect(store.getState().currentSeason).toBeNull();
    expect(store.getState().newSeasonNote).toBe(false);
  });

  it("a newer season resets the season stats and shows the note", () => {
    store.getState().hydrate(played());
    store.getState().applySeason(3);
    const s = store.getState();
    expect(s.currentSeason).toBe(3);
    expect(s.newSeasonNote).toBe(true);
    expect(s.progress.season).toMatchObject({ number: 3, distance: 0 });
    expect(s.progress.lifetimeDistance).toBe(5000);
    store.getState().dismissNewSeasonNote();
    expect(store.getState().newSeasonNote).toBe(false);
  });

  it("the same season changes nothing but the known number", () => {
    const p = played();
    store.getState().hydrate(p);
    store.getState().applySeason(2);
    expect(store.getState().currentSeason).toBe(2);
    expect(store.getState().newSeasonNote).toBe(false);
    expect(store.getState().progress).toBe(p);
  });

  it("an older season number never rolls the stats back", () => {
    const p = played();
    store.getState().hydrate(p);
    store.getState().applySeason(1);
    expect(store.getState().progress).toBe(p);
    expect(store.getState().newSeasonNote).toBe(false);
  });

  it("no note for a brand-new player or for season 1", () => {
    store.getState().applySeason(2);
    expect(store.getState().progress.season.number).toBe(2);
    expect(store.getState().newSeasonNote).toBe(false);

    store.setState(store.getInitialState(), true);
    store.getState().hydrate({ ...newProgress(), lifetimeDistance: 900 });
    store.getState().applySeason(1);
    expect(store.getState().progress.season.number).toBe(1);
    expect(store.getState().newSeasonNote).toBe(false);
  });

  it("a save loaded after the season read still starts the season", () => {
    store.getState().applySeason(3);
    store.getState().hydrate(startSeason(played(), 2));
    expect(store.getState().progress.season).toMatchObject({
      number: 3,
      distance: 0,
    });
  });
});

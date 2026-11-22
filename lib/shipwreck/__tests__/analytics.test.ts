import { trackCamera, trackEnd, trackStart } from "../analytics";
import { CAMERA_IDS } from "../types";
import { SHIP_IDS, SHIPS } from "../ships";
import { whatIfSpots } from "../sim/run";
import { GAME_EVENTS, isValidGameProps } from "@/lib/analytics/gameEvents";

const trackGame = jest.fn();
jest.mock("@/lib/analytics/trackGame", () => ({
  trackGame: (...args: unknown[]) => trackGame(...args),
}));

beforeEach(() => trackGame.mockClear());

describe("shipwreck analytics", () => {
  it("sends a start with the openings clamped to 0..16", () => {
    trackStart("whatif", 40, "titanic");
    trackStart("real", -3, "lusitania");
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_start", {
      mode: "whatif",
      opened: 16,
      ship: "titanic",
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_start", {
      mode: "real",
      opened: 0,
      ship: "lusitania",
    });
  });

  it("sends an end with whole minutes clamped to 0..600", () => {
    trackEnd("real", "sank", 160.7, "lusitania");
    trackEnd("whatif", "floated", 9999, "titanic");
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 160,
      ship: "lusitania",
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_end", {
      mode: "whatif",
      outcome: "floated",
      minutes: 600,
      ship: "titanic",
    });
  });

  it("counts breaking in two as sinking", () => {
    trackEnd("real", "broke-in-two", 155, "titanic");
    expect(trackGame).toHaveBeenCalledWith("shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 155,
      ship: "titanic",
    });
  });

  it("sends only the camera id, and everything passes the schema", () => {
    for (const camera of CAMERA_IDS) trackCamera(camera);
    for (const [name, props] of trackGame.mock.calls) {
      expect(isValidGameProps(name, props)).toBe(true);
    }
    expect(trackGame).toHaveBeenCalledTimes(CAMERA_IDS.length);
  });

  it("samples camera picks lower than starts and ends", () => {
    expect(GAME_EVENTS.shipwreck_camera.sample).toBeLessThan(
      GAME_EVENTS.shipwreck_start.sample
    );
    expect(GAME_EVENTS.shipwreck_camera.props.camera.values).toEqual(
      CAMERA_IDS
    );
  });

  it("sends a ship that passes the schema, for every ship the game has", () => {
    for (const ship of SHIP_IDS) {
      trackStart("whatif", 2, ship);
      trackEnd("whatif", "sank", 100, ship);
    }
    expect(trackGame).toHaveBeenCalledTimes(SHIP_IDS.length * 2);
    for (const [name, props] of trackGame.mock.calls) {
      expect(isValidGameProps(name, props)).toBe(true);
    }
  });

  it("keeps the ship enum equal to the game's ships, and accepts old events without one", () => {
    expect([...GAME_EVENTS.shipwreck_start.props.ship.values]).toEqual([
      ...SHIP_IDS,
    ]);
    expect([...GAME_EVENTS.shipwreck_end.props.ship.values]).toEqual([
      ...SHIP_IDS,
    ]);
    expect(
      isValidGameProps("shipwreck_start", { mode: "real", opened: 0 })
    ).toBe(true);
    expect(
      isValidGameProps("shipwreck_start", {
        mode: "real",
        opened: 0,
        ship: "britannic",
      })
    ).toBe(false);
    expect(
      isValidGameProps("shipwreck_start", {
        mode: "real",
        opened: 0,
        ship: 1,
      })
    ).toBe(false);
  });

  it("never needs more than 16 openings: the most any ship's What if? offers", () => {
    for (const id of SHIP_IDS) {
      expect(whatIfSpots(SHIPS[id]).length).toBeLessThanOrEqual(16);
    }
  });
});

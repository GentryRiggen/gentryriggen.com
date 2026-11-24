import { trackCamera, trackEnd, trackStart } from "../analytics";
import { CAMERA_IDS } from "../types";
import { SHIP_IDS, SHIPS } from "../ships";
import { whatIfSpots } from "../sim/run";
import {
  GAME_EVENTS,
  isValidGameProps,
  SHIPWRECK_MAX_OPENED,
} from "@/lib/analytics/gameEvents";

const trackGame = jest.fn();
jest.mock("@/lib/analytics/trackGame", () => ({
  trackGame: (...args: unknown[]) => trackGame(...args),
}));

beforeEach(() => trackGame.mockClear());

describe("shipwreck analytics", () => {
  it("sends a start with the openings clamped to 0..25", () => {
    trackStart("whatif", 40, "titanic");
    trackStart("real", -3, "lusitania");
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_start", {
      mode: "whatif",
      opened: 25,
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

  it("counts resting aground (the Concordia) as sinking: the outcome enum is unchanged", () => {
    trackEnd("real", "aground", 176, "concordia");
    expect(trackGame).toHaveBeenCalledWith("shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 176,
      ship: "concordia",
    });
    expect(isValidGameProps("shipwreck_end", trackGame.mock.calls[0][1])).toBe(
      true
    );
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
        ship: "andrea-doria",
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

  it("never needs more openings than the schema allows", () => {
    for (const id of SHIP_IDS) {
      expect(whatIfSpots(SHIPS[id]).length).toBeLessThanOrEqual(
        SHIPWRECK_MAX_OPENED
      );
    }
    const most = Math.max(
      ...SHIP_IDS.map((id) => whatIfSpots(SHIPS[id]).length)
    );
    expect(SHIPWRECK_MAX_OPENED).toBe(most);
    expect(GAME_EVENTS.shipwreck_start.props.opened.max).toBe(most);
  });

  it("sends the Carpathia's runs, and rejects a wrong case", () => {
    trackStart("whatif", 10, "carpathia");
    trackEnd("real", "sank", 104, "carpathia");
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_start", {
      mode: "whatif",
      opened: 10,
      ship: "carpathia",
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 104,
      ship: "carpathia",
    });
    for (const [name, props] of trackGame.mock.calls) {
      expect(isValidGameProps(name, props)).toBe(true);
    }
    for (const ship of ["Carpathia", "andrea-doria"]) {
      expect(
        isValidGameProps("shipwreck_start", { mode: "real", opened: 0, ship })
      ).toBe(false);
      expect(
        isValidGameProps("shipwreck_end", {
          mode: "real",
          outcome: "sank",
          minutes: 1,
          ship,
        })
      ).toBe(false);
    }
  });

  it("counts her finishing torpedo as one spot: spots stay within the schema max", () => {
    expect(whatIfSpots(SHIPS.carpathia).length).toBeLessThanOrEqual(10);
  });

  it("sends the Fitzgerald's runs", () => {
    trackStart("whatif", 25, "fitzgerald");
    trackEnd("real", "sank", 20, "fitzgerald");
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_start", {
      mode: "whatif",
      opened: 25,
      ship: "fitzgerald",
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 20,
      ship: "fitzgerald",
    });
  });

  it("sends the Britannic's runs", () => {
    trackStart("whatif", 16, "britannic");
    trackEnd("real", "sank", 55, "britannic");
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_start", {
      mode: "whatif",
      opened: 16,
      ship: "britannic",
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 55,
      ship: "britannic",
    });
    for (const [name, props] of trackGame.mock.calls) {
      expect(isValidGameProps(name, props)).toBe(true);
    }
  });

  it("sends the Concordia's runs, and an aground end counts as sank", () => {
    trackStart("real", 0, "concordia");
    trackEnd("real", "aground", 150, "concordia");
    trackEnd("whatif", "floated", 30, "concordia");
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_start", {
      mode: "real",
      opened: 0,
      ship: "concordia",
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 150,
      ship: "concordia",
    });
    expect(trackGame).toHaveBeenNthCalledWith(3, "shipwreck_end", {
      mode: "whatif",
      outcome: "floated",
      minutes: 30,
      ship: "concordia",
    });
    // The outcome enum stays sank/floated: no "aground" in the schema.
    expect([...GAME_EVENTS.shipwreck_end.props.outcome.values]).toEqual([
      "sank",
      "floated",
    ]);
    for (const [name, props] of trackGame.mock.calls) {
      expect(isValidGameProps(name, props)).toBe(true);
    }
  });

  it("sends the Poseidon's runs, and a capsize counts as sank", () => {
    trackStart("real", 0, "poseidon");
    trackEnd("real", "capsized", 40, "poseidon");
    trackEnd("whatif", "floated", 30, "poseidon");
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_start", {
      mode: "real",
      opened: 0,
      ship: "poseidon",
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 40,
      ship: "poseidon",
    });
    expect(trackGame).toHaveBeenNthCalledWith(3, "shipwreck_end", {
      mode: "whatif",
      outcome: "floated",
      minutes: 30,
      ship: "poseidon",
    });
    // Capsized is not a schema outcome, and no wave prop was added.
    expect([...GAME_EVENTS.shipwreck_end.props.outcome.values]).toEqual([
      "sank",
      "floated",
    ]);
    expect(Object.keys(GAME_EVENTS.shipwreck_end.props).sort()).toEqual([
      "minutes",
      "mode",
      "outcome",
      "ship",
    ]);
    expect(Object.keys(GAME_EVENTS.shipwreck_start.props).sort()).toEqual([
      "mode",
      "opened",
      "ship",
    ]);
    for (const [name, props] of trackGame.mock.calls) {
      expect(isValidGameProps(name, props)).toBe(true);
    }
  });
});

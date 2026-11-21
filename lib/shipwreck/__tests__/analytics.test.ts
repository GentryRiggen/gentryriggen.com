import { trackCamera, trackEnd, trackStart } from "../analytics";
import { CAMERA_IDS } from "../types";
import { GAME_EVENTS, isValidGameProps } from "@/lib/analytics/gameEvents";

const trackGame = jest.fn();
jest.mock("@/lib/analytics/trackGame", () => ({
  trackGame: (...args: unknown[]) => trackGame(...args),
}));

beforeEach(() => trackGame.mockClear());

describe("shipwreck analytics", () => {
  it("sends a start with the openings clamped to 0..16", () => {
    trackStart("whatif", 40);
    trackStart("real", -3);
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_start", {
      mode: "whatif",
      opened: 16,
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_start", {
      mode: "real",
      opened: 0,
    });
  });

  it("sends an end with whole minutes clamped to 0..600", () => {
    trackEnd("real", "sank", 160.7);
    trackEnd("whatif", "floated", 9999);
    expect(trackGame).toHaveBeenNthCalledWith(1, "shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 160,
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "shipwreck_end", {
      mode: "whatif",
      outcome: "floated",
      minutes: 600,
    });
  });

  it("counts breaking in two as sinking", () => {
    trackEnd("real", "broke-in-two", 155);
    expect(trackGame).toHaveBeenCalledWith("shipwreck_end", {
      mode: "real",
      outcome: "sank",
      minutes: 155,
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
});

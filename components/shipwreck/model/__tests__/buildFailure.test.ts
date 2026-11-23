import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import * as textures from "../textures";
import { createTitanicModel } from "../shipModel";

jest.mock("../textures", () => {
  const tex = () => new (jest.requireActual("three").Texture)();
  return {
    acquireShipTextures: () => ({
      plateNormal: tex(),
      weathering: tex(),
      planks: tex(),
      names: tex(),
      dispose() {},
    }),
    releaseShipTextures: jest.fn(),
    acquireDazzleTexture: jest.fn(() => tex()),
    releaseDazzleTexture: jest.fn(),
  };
});
// Fails late: after the textures and materials are made.
jest.mock("../buildShip", () => ({
  ...jest.requireActual("../buildShip"),
  buildShipPart: () => {
    throw new Error("boom");
  },
}));

describe("a model build that throws", () => {
  it("lets go of the dazzle and name textures it took", () => {
    const acquired = textures.acquireDazzleTexture as jest.Mock;
    const released = textures.releaseDazzleTexture as jest.Mock;
    const names = textures.releaseShipTextures as jest.Mock;
    expect(() =>
      createTitanicModel(carpathia, { quality: "low", breakX: null })
    ).toThrow("boom");
    expect(acquired).toHaveBeenCalledTimes(1);
    expect(released).toHaveBeenCalledTimes(1);
    expect(released.mock.calls[0][0]).toBe(acquired.mock.results[0].value);
    expect(names).toHaveBeenCalledTimes(1);
  });
});

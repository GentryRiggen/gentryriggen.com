import { PerspectiveCamera, type WebGLRenderer } from "three";
import { loadPlanetTextures } from "../../planetTextures";
import { getChunkSet } from "../chunks";
import {
  BODY_WARMUP_DELAY_MS,
  WARMUP_DELAY_MS,
  scheduleChunkWarmup,
} from "../chunkWarmup";

jest.mock("../../planetTextures", () => ({
  loadPlanetTextures: jest.fn(() => Promise.resolve({})),
}));
jest.mock("../collisionBody", () => ({
  ...jest.requireActual("../collisionBody"),
  getBodyChunks: jest.fn(),
}));
jest.mock("../chunks", () => ({
  getChunkSet: jest.fn(() => ({
    seeds: [],
    set: { geometries: [new (jest.requireActual("three").BufferGeometry)()] },
  })),
}));

describe("scheduleChunkWarmup", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("builds the chunk set and compiles after the delay, not before", () => {
    const spy = getChunkSet as jest.Mock;
    spy.mockClear();
    const compileAsync = jest.fn().mockResolvedValue(undefined);
    const gl = { compileAsync } as unknown as WebGLRenderer;
    scheduleChunkWarmup(gl, new PerspectiveCamera());
    jest.advanceTimersByTime(WARMUP_DELAY_MS - 1);
    expect(spy).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalled();
    expect(compileAsync).toHaveBeenCalledTimes(1);
  });

  it("does nothing once cancelled", () => {
    const compileAsync = jest.fn();
    const cancel = scheduleChunkWarmup(
      { compileAsync } as unknown as WebGLRenderer,
      new PerspectiveCamera()
    );
    cancel();
    jest.advanceTimersByTime(WARMUP_DELAY_MS * 2);
    expect(compileAsync).not.toHaveBeenCalled();
  });

  it("prefetches the collision body's textures in idle time", () => {
    const load = loadPlanetTextures as jest.Mock;
    load.mockClear();
    const gl = { compileAsync: jest.fn() } as unknown as WebGLRenderer;
    scheduleChunkWarmup(gl, new PerspectiveCamera(), () => "earth");
    jest.advanceTimersByTime(WARMUP_DELAY_MS + BODY_WARMUP_DELAY_MS - 1);
    expect(load).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(load).toHaveBeenCalledWith("mars");
  });

  it("prefetches Earth when the planet is not Earth", () => {
    const load = loadPlanetTextures as jest.Mock;
    load.mockClear();
    const gl = { compileAsync: jest.fn() } as unknown as WebGLRenderer;
    scheduleChunkWarmup(gl, new PerspectiveCamera(), () => "mars");
    jest.advanceTimersByTime(WARMUP_DELAY_MS + BODY_WARMUP_DELAY_MS);
    expect(load).toHaveBeenCalledWith("earth");
  });
});

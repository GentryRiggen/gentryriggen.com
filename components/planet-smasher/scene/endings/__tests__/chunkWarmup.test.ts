import { PerspectiveCamera, type WebGLRenderer } from "three";
import { getChunkSet } from "../chunks";
import { WARMUP_DELAY_MS, scheduleChunkWarmup } from "../chunkWarmup";

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
});

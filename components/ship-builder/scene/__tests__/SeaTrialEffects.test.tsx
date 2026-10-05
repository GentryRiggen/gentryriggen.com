import { act } from "react";
import { render } from "@testing-library/react";
import { createTrial } from "@/lib/ship-builder/sim/seaTrial";
import type { TrialInput } from "@/lib/ship-builder/sim/types";
import {
  createInitialState,
  useShipBuilderStore,
} from "@/lib/ship-builder/state/store";
import SeaTrialEffects from "../SeaTrialEffects";
import { resetPlayback, trialPlayback } from "../trialPlayback";

type FrameCallback = (state: unknown, delta: number) => void;
let frame: FrameCallback | null = null;

jest.mock("@react-three/fiber", () => ({
  useFrame: (callback: FrameCallback) => {
    frame = callback;
  },
}));
jest.mock("../ParticleField", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../hooks/usePrefersReducedMotion", () => ({
  __esModule: true,
  default: () => false,
}));

const INPUT: TrialInput = {
  ship: { stabilityRatio: 0, listAngle: 0, beam: 5 },
  sea: "calm",
};

function showResult() {
  act(() =>
    useShipBuilderStore.setState({
      ...createInitialState(),
      trial: {
        status: "result",
        input: INPUT,
        state: createTrial(INPUT),
        runId: 1,
        descending: false,
      },
    })
  );
}

function runFrame(delta = 0.1) {
  act(() => frame?.({}, delta));
}

beforeEach(() => {
  frame = null;
  act(() => resetPlayback());
  showResult();
});

describe("SeaTrialEffects clock on the result", () => {
  it("keeps the effects clock running behind the result card", () => {
    render(<SeaTrialEffects />);
    runFrame();
    expect(trialPlayback.time).toBeCloseTo(0.1, 6);
  });

  it("does not move a moment that is being scrubbed", () => {
    render(<SeaTrialEffects />);
    trialPlayback.time = 5;
    trialPlayback.scrubbing = true;
    runFrame();
    expect(trialPlayback.time).toBe(5);
  });

  it("keeps a scrubbed moment frozen after release", () => {
    render(<SeaTrialEffects />);
    trialPlayback.time = 5;
    trialPlayback.scrubbed = true;
    runFrame();
    expect(trialPlayback.time).toBe(5);
  });
});

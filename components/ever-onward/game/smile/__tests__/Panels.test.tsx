import { fireEvent, render, screen } from "@testing-library/react";
import { tick } from "@/lib/ever-onward/engine/engine";
import type { RunState } from "@/lib/ever-onward/engine/types";
import { smileUniverse as def } from "@/lib/ever-onward/universes/smile";
import { FORKS } from "@/lib/ever-onward/universes/smile/forks";
import { runAtPhaseStart } from "@/lib/ever-onward/universes/smile/__tests__/fixtures";
import { areSmileScoresValid } from "../../../audio/smileScores";
import { SMILE_UI } from "../../../universes/smile";
import CheerMeter from "../CheerMeter";
import FriendPanel from "../FriendPanel";
import KnowHowPanel from "../KnowHowPanel";
import SmileForkPanel from "../SmileForkPanel";
import TogetherPanel from "../TogetherPanel";
import TownPanel from "../TownPanel";

const advance = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let t = 0; t < seconds; t += 1) next = tick(def, next, 1);
  return next;
};

function withOwned(
  run: RunState,
  owned: Record<string, number>,
  resources: Record<string, number> = {}
): RunState {
  return {
    ...run,
    owned: { ...run.owned, ...owned },
    resources: { ...run.resources, ...resources },
  };
}

describe("Smile panels", () => {
  it("shows both sides of the fork with the catch told before anything is spent", () => {
    const onAct = jest.fn();
    const run = withOwned(runAtPhaseStart(0), { balloon: 3 }, { smiles: 1e6 });
    render(<SmileForkPanel def={def} run={run} onAct={onAct} />);
    const fork = FORKS[0];
    for (const side of [0, 1] as const) {
      const card = screen.getByTestId(`ms-fork-${side}`);
      expect(card).toHaveTextContent(fork.sides[side].name);
      expect(card).toHaveTextContent(
        `The catch: ${fork.sides[side].catchLine}`
      );
    }
    fireEvent.click(screen.getByTestId("ms-fork-1-choose"));
    expect(onAct).toHaveBeenCalledWith("fork-friend-1");
  });

  it("stays hidden until the fork opens", () => {
    const { container } = render(
      <SmileForkPanel def={def} run={runAtPhaseStart(0)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers what you do together only with the bracelet, as a radio group that shows the + and the - and never a best", () => {
    const onAct = jest.fn();
    const closed = withOwned(runAtPhaseStart(0), { puppy: 1 });
    const { container, rerender } = render(
      <TogetherPanel def={def} run={closed} onAct={onAct} />
    );
    expect(container).toBeEmptyDOMElement();
    const open = advance(withOwned(closed, { bracelet: 1 }), 2);
    rerender(<TogetherPanel def={def} run={open} onAct={onAct} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    for (const i of [0, 1, 2]) {
      const card = screen.getByTestId(`ms-together-${i}`);
      expect(card).toHaveTextContent("+ ");
      expect(card).toHaveTextContent("− ");
    }
    expect(screen.getByTestId("ms-together").textContent).not.toMatch(
      /best|recommend/i
    );
    expect(screen.getByTestId("ms-together-face")).toHaveTextContent(
      "Their face looks like it wants"
    );
    fireEvent.click(screen.getByTestId("ms-together-1"));
    expect(onAct).toHaveBeenCalledWith("tg-1");
  });

  it("shows the cheer meter in the world only: the town has its own two dials", () => {
    const { container, rerender } = render(
      <CheerMeter def={def} run={runAtPhaseStart(0)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <CheerMeter def={def} run={runAtPhaseStart(1)} onAct={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <CheerMeter def={def} run={runAtPhaseStart(2)} onAct={jest.fn()} />
    );
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
    rerender(
      <CheerMeter
        def={def}
        run={withOwned(runAtPhaseStart(2), {}, { mtHeat: 1.1, mtTired: 1 })}
        onAct={jest.fn()}
      />
    );
    expect(screen.getByTestId("ms-meter")).toHaveAttribute("data-tired", "yes");
    expect(screen.getByTestId("ms-meter-result")).toHaveTextContent(
      /worn out/i
    );
  });

  it("offers the town's stand and route once a clown is hired, showing the + and the - and never a best", () => {
    const onAct = jest.fn();
    const closed = runAtPhaseStart(1);
    const { container, rerender } = render(
      <TownPanel def={def} run={closed} onAct={onAct} />
    );
    expect(container).toBeEmptyDOMElement();
    const open = advance(withOwned(closed, { clown: 3 }), 2);
    rerender(<TownPanel def={def} run={open} onAct={onAct} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    for (const i of [0, 1, 2, 3, 4]) {
      const card = screen.getByTestId(`ms-price-${i}`);
      expect(card).toHaveTextContent("+ ");
      expect(card).toHaveTextContent("− ");
    }
    expect(screen.getByTestId("ms-town").textContent).not.toMatch(
      /best|recommend/i
    );
    for (const i of [0, 1, 2, 3])
      expect(screen.getByTestId(`ms-street-${i}`)).toBeInTheDocument();
    expect(screen.getByTestId("ms-town-day")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ms-price-0"));
    expect(onAct).toHaveBeenCalledWith("st-0");
    fireEvent.click(screen.getByTestId("ms-send-3"));
    expect(onAct).toHaveBeenCalledWith("rt-3");
  });

  it("holds the world's projects and broadcast in one know-how panel", () => {
    const onAct = jest.fn();
    const run = withOwned(
      runAtPhaseStart(2),
      { poster: 3, loudspeaker: 1 },
      { knowhow: 500 }
    );
    render(<KnowHowPanel def={def} run={advance(run, 1)} onAct={onAct} />);
    expect(screen.getByTestId("ms-knowhow")).toBeInTheDocument();
    expect(screen.getByTestId("ms-parade")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ms-parade-start"));
    expect(onAct).toHaveBeenCalledWith("parade-start");
  });

  it("lets you sit with the friend: three answers, none of them wrong", () => {
    const onAct = jest.fn();
    const run = advance(runAtPhaseStart(3), 40);
    render(<FriendPanel def={def} run={run} onAct={onAct} />);
    expect(screen.getByTestId("ms-friend")).toHaveAttribute(
      "data-wanting",
      "true"
    );
    expect(screen.getAllByRole("button")).toHaveLength(3);
    fireEvent.click(screen.getByTestId("ms-friend-tea"));
    expect(onAct).toHaveBeenCalledWith("quiet-2");
  });

  it("has music for every part and a title theme", () => {
    expect(areSmileScoresValid()).toBe(true);
    expect(SMILE_UI.audio.scores).toHaveLength(4);
    expect(SMILE_UI.audio.unease).toHaveLength(4);
  });
});

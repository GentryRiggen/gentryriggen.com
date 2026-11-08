import { render, screen } from "@testing-library/react";
import { newRun } from "@/lib/ever-onward/engine/engine";
import { lightUniverse as def } from "@/lib/ever-onward/universes/light";
import { sceneInfo } from "@/lib/ever-onward/universes/light";
import type { LightSceneInfo } from "@/lib/ever-onward/universes/light";
import CoastLayer from "../CoastLayer";

function view(change: Partial<LightSceneInfo>) {
  const run = newRun(def);
  run.owned = { keeper: 6, lens: 1 };
  const info: LightSceneInfo = { ...sceneInfo(run), tollOpen: 1, ...change };
  return render(
    <svg>
      <CoastLayer info={info} />
    </svg>
  );
}

describe("the coast scene", () => {
  it("sends the ships that choose the harbor to the quay, and the rest on to the rival", () => {
    // three ships on the water (two plus one lens): half the traffic is two of them
    view({ traffic: 5 });
    expect(screen.getAllByTestId("lm-ship-dock")).toHaveLength(2);
    expect(screen.getAllByTestId("lm-ship-pass")).toHaveLength(1);
    expect(screen.getByText("TOO PRICEY!")).toBeInTheDocument();
  });

  it("has every ship dock when the whole traffic comes, and none when it stays away", () => {
    const full = view({ traffic: 10 });
    expect(screen.queryAllByTestId("lm-ship-pass")).toHaveLength(0);
    full.unmount();
    view({ traffic: 0 });
    expect(screen.queryAllByTestId("lm-ship-dock")).toHaveLength(0);
  });

  it("shows the toll on the quay's sign", () => {
    view({ tollStep: 3 });
    expect(screen.getByTestId("lm-toll-sign")).toHaveAttribute(
      "data-step",
      "3"
    );
  });

  it("shows one banner at a time: the dark outranks the relight, and both outrank the tanker", () => {
    const both = view({ tanker: 1, tankerDeal: 1, darkBanner: 1, relit: 1 });
    expect(screen.getByTestId("lm-banner-dark")).toBeInTheDocument();
    expect(screen.queryByTestId("lm-banner-relit")).toBeNull();
    expect(screen.queryByTestId("lm-banner-cheap")).toBeNull();
    both.unmount();
    const relit = view({ tanker: 1, tankerDeal: 1, relit: 1 });
    expect(screen.getByTestId("lm-banner-relit")).toBeInTheDocument();
    expect(screen.queryByTestId("lm-banner-cheap")).toBeNull();
    relit.unmount();
    view({ tanker: 1, tankerDeal: 2 });
    expect(screen.getByTestId("lm-banner-cheap")).toBeInTheDocument();
    expect(screen.getByTestId("lm-tanker-scene")).toHaveAttribute(
      "data-deal",
      "2"
    );
  });

  it("rolls barrels into the tanks and fills the tank in the picture", () => {
    view({ barrels: 1, oilFraction: 0.7 });
    expect(screen.getByTestId("lm-barrels")).toBeInTheDocument();
    expect(screen.getByTestId("lm-tank-fill")).toHaveAttribute(
      "data-level",
      "7"
    );
  });

  it("goes dark when the lamp is dry: a ship near the rocks, no huffing ships, a dimmed picture", () => {
    view({ lampDry: 1, traffic: 3 });
    expect(screen.getByTestId("lm-dark-ship")).toBeInTheDocument();
    expect(screen.getByTestId("lm-dark-dim")).toBeInTheDocument();
    expect(screen.queryByText("TOO PRICEY!")).toBeNull();
  });
});

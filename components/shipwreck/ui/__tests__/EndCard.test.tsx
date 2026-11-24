import { cleanup, render, screen } from "@testing-library/react";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import { simulate, whatIfOpenings } from "@/lib/shipwreck/sim/run";
import type { SimEvent } from "@/lib/shipwreck/sim/events";
import type { SimTrack } from "@/lib/shipwreck/sim/track";
// The Concordia's to-sea run takes ~8 s: its saved summary
// (concordiaToSeaFixture, checked against the sim in the sims lane).
import toSea from "@/lib/shipwreck/sim/__tests__/fixtures/concordiaToSea.json";
import { endWords, historyNote } from "@/lib/shipwreck/story";
import EndCard from "../EndCard";

/** A storm run that reached shelter (what the sim's `sheltered` ends with). */
function sheltered(): SimTrack {
  const t = fitzgerald.shelter!.t;
  return {
    frames: [
      {
        t,
        realT: t,
        bodies: [
          { part: "whole", x: 0, y: 0, z: -8.6, pitch: 0, roll: 0, yaw: 0 },
        ],
        water: [],
        waterAboardT: 900,
        trimDeg: 0,
        listDeg: 3,
        power: 1,
        groundedParts: [],
      },
    ],
    events: [{ kind: "sheltered", t, realT: t }],
    outcome: "floated",
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT: t,
  };
}

describe("the end card for a storm ship", () => {
  it("reads 'She made it to Whitefish Bay.' when she floats into shelter", () => {
    const words = endWords(sheltered(), fitzgerald, 0, { storm: "real" });
    render(
      <EndCard
        words={words}
        history={historyNote(fitzgerald)}
        cause="storm"
        isNew={false}
        onWatchAgain={() => {}}
        onWhatIf={() => {}}
        onLook={() => {}}
      />
    );
    const card = screen.getByTestId("shipwreck-end");
    expect(card).toHaveAttribute("data-outcome", "floated");
    expect(
      screen.getByRole("heading", { name: "She made it to Whitefish Bay." })
    ).toBeInTheDocument();
    expect(card).toHaveTextContent(/8:25\sPM/);
    // Floated: no "What really happened" under it, and her own icon.
    expect(card).not.toHaveTextContent("What really happened");
    expect(screen.getByTestId("shipwreck-look")).toHaveTextContent(
      "Look around"
    );
  });
});

describe("the Carpathia's end card", () => {
  it("reads her sinking time and Snowdrop for her real run", () => {
    const track = simulate(carpathia, carpathia.realNight);
    const words = endWords(track, carpathia, 4, { hits: 3 });
    render(
      <EndCard
        words={words}
        history={historyNote(carpathia)}
        cause={carpathia.cause}
        isNew={false}
        onWatchAgain={() => {}}
        onWhatIf={() => {}}
        onLook={() => {}}
      />
    );
    const card = screen.getByTestId("shipwreck-end");
    expect(card).toHaveAttribute("data-outcome", "sank");
    expect(card).toHaveTextContent(/Carpathia sank at 11:0\d AM/);
    expect(card).toHaveTextContent(/after the first torpedo hit/);
    expect(card).toHaveTextContent(
      /HMS Snowdrop came and picked up her lifeboats/
    );
  });
});

/** A mine ship's run that floated, ending with `kind` (one frame). */
function mineAfloat(kind: SimEvent["kind"]): SimTrack {
  const t = 4000;
  return {
    frames: [
      {
        t,
        realT: t,
        bodies: [
          { part: "whole", x: 0, y: 0, z: -12, pitch: 0.05, roll: 0, yaw: 0 },
        ],
        water: [],
        waterAboardT: 20000,
        trimDeg: 3,
        listDeg: 1,
        power: 1,
        groundedParts: [],
      },
    ],
    events: [{ kind, t, realT: t }],
    outcome: "floated",
    sankAtT: null,
    brokeAtT: null,
    breakX: null,
    endT: t,
  };
}

function card(track: SimTrack, ctx = {}) {
  render(
    <EndCard
      words={endWords(track, britannic, 1, ctx)}
      history={historyNote(britannic)}
      cause="mine"
      isNew={false}
      onWatchAgain={() => {}}
      onWhatIf={() => {}}
      onLook={() => {}}
    />
  );
  return screen.getByTestId("shipwreck-end");
}

describe("the end card for a mine ship (the Britannic)", () => {
  it("reads 'She reached Kea.' when she gets to the shore", () => {
    const c = card(mineAfloat("sheltered"));
    expect(c).toHaveAttribute("data-outcome", "floated");
    expect(
      screen.getByRole("heading", { name: "She reached Kea." })
    ).toBeInTheDocument();
    expect(c).not.toHaveTextContent("What really happened");
  });

  it("reads 'She stayed afloat.' when the water stops rising", () => {
    const c = card(mineAfloat("floating-steady"), { doorsClosed: true });
    expect(
      screen.getByRole("heading", { name: "She stayed afloat." })
    ).toBeInTheDocument();
    expect(c).toHaveTextContent(/With her doors closed/);
    // Her own icon on What if?: the mine.
    expect(screen.getByTestId("shipwreck-try-what-if")).toBeInTheDocument();
    cleanup();
  });

  it("ends the real morning: 'She sank at 9:07 AM, 55 minutes after the mine.'", () => {
    const c = card(simulate(britannic, britannic.realNight));
    expect(c).toHaveAttribute("data-outcome", "sank");
    expect(screen.getByRole("heading")).toHaveTextContent(
      /^HMHS Britannic sank at 9:0\d AM$/
    );
    expect(c).toHaveTextContent(
      "She sank at 9:07 AM, 55 minutes after the mine."
    );
    expect(c).toHaveTextContent(/her bow hit the floor while her stern/);
    expect(screen.getByTestId("shipwreck-look")).toHaveTextContent(
      "Look at the wreck"
    );
    expect(c).not.toHaveTextContent(/Stopping her engines/);
    cleanup();
  });

  it("says what mattered when Run for Kea alone was off", () => {
    const track = simulate(britannic, britannic.realNight, {
      enginesStopped: true,
    });
    const c = card(track, { enginesStopped: true, realSpot: true, hits: 1 });
    expect(c).toHaveAttribute("data-outcome", "sank");
    expect(c).toHaveTextContent(
      "Stopping her engines changed little. Her open portholes and the door that did not shut mattered most."
    );
  });
});

describe("the Costa Concordia's end cards (1.9)", () => {
  function rocksCard(track: SimTrack, holes: number, ctx = {}) {
    render(
      <EndCard
        words={endWords(track, concordia, holes, ctx)}
        history={historyNote(concordia)}
        cause="rocks"
        isNew={false}
        onWatchAgain={() => {}}
        onWhatIf={() => {}}
        onLook={() => {}}
      />
    );
    return screen.getByTestId("shipwreck-end");
  }

  it("reads her real night's rest from the run, with her own What if picture", () => {
    const card = rocksCard(simulate(concordia, concordia.realNight), 5);
    expect(card).toHaveAttribute("data-outcome", "aground");
    expect(card).toHaveTextContent(
      "She came to rest on her side by Giglio's harbour at 12:41 AM, 2 hours 56 minutes after the rocks."
    );
    expect(card).toHaveTextContent(/What really happened: the real Costa/);
    expect(screen.getByTestId("shipwreck-look")).toHaveTextContent(
      "Look at the wreck"
    );
    // The rocks' own picture, not the iceberg's.
    const icon = screen
      .getByTestId("shipwreck-try-what-if")
      .querySelector("svg path")!;
    expect(icon.getAttribute("d")).toMatch(/^M3 8h14l3-3/);
  });

  it("reads the safe sail past, and the wind out to sea", () => {
    const none = rocksCard(
      simulate(concordia, whatIfOpenings(concordia, [])),
      0
    );
    expect(none).toHaveAttribute("data-outcome", "floated");
    expect(none).toHaveTextContent("She sailed safely past the island.");
    expect(none).not.toHaveTextContent("What really happened");
    cleanup();
    const sea = rocksCard(toSea.night as SimTrack, 5, { toSea: true });
    expect(sea).toHaveAttribute("data-outcome", "sank");
    expect(sea).toHaveTextContent("Blown out to sea, she sank.");
    expect(sea).not.toHaveTextContent(/rolled|capsiz/);
  });
});

describe("the end card for the Poseidon (1.11)", () => {
  function waveCard(track: SimTrack, holes: number) {
    const words = endWords(track, poseidon, holes);
    render(
      <EndCard
        words={words}
        history={historyNote(poseidon)}
        cause="wave"
        isNew={false}
        onWatchAgain={() => {}}
        onWhatIf={() => {}}
        onLook={() => {}}
      />
    );
    return screen.getByTestId("shipwreck-end");
  }
  const run = (ids: string[], wave: "real" | "smaller" | "ahead" = "real") =>
    simulate(poseidon, whatIfOpenings(poseidon, ids, wave), { wave });

  it("reads her real night from the run: floated upside down, then sank", () => {
    const real = simulate(poseidon, poseidon.realNight);
    const card = waveCard(real, 7);
    expect(card).toHaveAttribute("data-outcome", "sank");
    expect(card).toHaveTextContent(
      /Upside down, she floated for 47 minutes, then sank at 12:45 AM\./
    );
    expect(card).toHaveTextContent(/What really happened: nothing/);
    expect(screen.getByTestId("shipwreck-look")).toHaveTextContent(
      "Look at the wreck"
    );
    // A wave, not the iceberg or the storm cloud.
    const icon = screen
      .getByTestId("shipwreck-try-what-if")
      .querySelector("svg path")!;
    expect(icon.getAttribute("d")).toMatch(/^M2 20c3\.5/);
  });

  it("reads each What if from its own outcome, not the wave chosen", () => {
    expect(waveCard(run([], "smaller"), 0)).toHaveTextContent(
      "She leaned far over, then stood up again."
    );
    cleanup();
    expect(waveCard(run([], "ahead"), 0)).toHaveTextContent(
      "She rode over the wave."
    );
    cleanup();
    const up = waveCard(run([]), 0);
    expect(up).toHaveAttribute("data-outcome", "capsized");
    expect(up).toHaveTextContent("Upside down, she was still floating.");
    // Afloat, even upside down: look around her, no wreck.
    expect(screen.getByTestId("shipwreck-look")).toHaveTextContent(
      "Look around"
    );
    expect(up).not.toHaveTextContent("What really happened");
  }, 30_000);
});

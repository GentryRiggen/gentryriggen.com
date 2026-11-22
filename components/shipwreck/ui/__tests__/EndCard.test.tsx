import { render, screen } from "@testing-library/react";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import type { SimTrack } from "@/lib/shipwreck/sim/track";
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

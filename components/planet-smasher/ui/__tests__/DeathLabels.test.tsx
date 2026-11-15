import { render, screen } from "@testing-library/react";
import DeathLabels, { deathLabelText, paintDeathLabel } from "../DeathLabels";
import {
  addDeathLabel,
  clearDeathLabels,
  deathLabelEls,
  deathLabels,
} from "@/lib/planet-smasher/deathLabels";

describe("DeathLabels", () => {
  beforeEach(() => clearDeathLabels());

  it("shows a splash under 1,000 people and a skull count above", () => {
    expect(deathLabelText(950)).toBe("💦");
    expect(deathLabelText(41_000_000)).toBe("💀 41M");
  });

  it("renders a label with the count when painted", () => {
    render(<DeathLabels />);
    addDeathLabel(41_000_000, 0.5, 0.5, 8_000_000_000);
    const label = deathLabels.find((l) => l.active)!;
    const slot = deathLabels.indexOf(label);
    paintDeathLabel(deathLabelEls[slot]!, label, 100, 200);
    expect(screen.getByText("💀 41M")).toBeInTheDocument();
    expect(screen.getByTestId("death-labels").children).toHaveLength(6);
  });
});

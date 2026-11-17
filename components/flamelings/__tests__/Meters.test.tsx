import { render, screen } from "@testing-library/react";
import { createPet } from "@/lib/flamelings/actions";
import type { Pet } from "@/lib/flamelings/types";
import Meters from "../Meters";

const NOON = new Date(2026, 10, 17, 12).getTime();
const look = { colour: "ember", shape: "flame", eyes: "round" } as const;

function petWith(patch: Partial<Pet>): Pet {
  return { ...createPet({ id: "a", name: "Pip", look, now: NOON }), ...patch };
}

describe("Meters", () => {
  it("shows each need as a named progressbar", () => {
    render(<Meters pet={petWith({ fuel: 80.4, joy: 55.6, ash: 1 })} />);
    expect(screen.getByRole("progressbar", { name: "Fuel" })).toHaveAttribute(
      "aria-valuenow",
      "80"
    );
    expect(screen.getByRole("progressbar", { name: "Joy" })).toHaveAttribute(
      "aria-valuenow",
      "56"
    );
    const tidy = screen.getByRole("progressbar", { name: "Tidy" });
    expect(tidy).toHaveAttribute("aria-valuenow", "75");
    expect(tidy).toHaveAttribute("aria-valuemin", "0");
    expect(tidy).toHaveAttribute("aria-valuemax", "100");
  });

  it("marks a need under 30 as low", () => {
    render(<Meters pet={petWith({ joy: 12 })} />);
    expect(screen.getByRole("progressbar", { name: "Joy" })).toHaveAttribute(
      "data-low",
      "true"
    );
    expect(screen.getByRole("progressbar", { name: "Fuel" })).toHaveAttribute(
      "data-low",
      "false"
    );
  });
});

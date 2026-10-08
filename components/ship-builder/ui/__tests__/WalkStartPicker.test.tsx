import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WalkStartPicker from "../WalkStartPicker";

describe("WalkStartPicker", () => {
  it("offers front, middle and back, each with its own picture", () => {
    const { container } = render(
      <WalkStartPicker id="card" onPick={jest.fn()} />
    );
    expect(
      screen.getByRole("dialog", { name: "Where do you want to start?" })
    ).toHaveAttribute("id", "card");
    expect(
      screen.getByRole("heading", { name: "Where do you want to start?" })
    ).toBeVisible();
    for (const name of ["Front (bow)", "Middle", "Back (stern)"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
    const pictures = container.querySelectorAll("svg");
    expect(pictures).toHaveLength(3);
    pictures.forEach((svg) =>
      expect(svg).toHaveAttribute("aria-hidden", "true")
    );
  });

  it("reports the spot that was picked", async () => {
    const onPick = jest.fn();
    const user = userEvent.setup();
    render(<WalkStartPicker id="card" onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "Front (bow)" }));
    await user.click(screen.getByRole("button", { name: "Middle" }));
    await user.click(screen.getByRole("button", { name: "Back (stern)" }));
    expect(onPick.mock.calls).toEqual([["bow"], ["middle"], ["stern"]]);
  });
});

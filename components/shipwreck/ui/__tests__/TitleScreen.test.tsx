import { fireEvent, render, screen } from "@testing-library/react";
import TitleScreen from "../TitleScreen";

function title(ship: "titanic" | "lusitania") {
  const onShip = jest.fn();
  render(
    <TitleScreen
      ship={ship}
      onShip={onShip}
      onRealNight={() => {}}
      onWhatIf={() => {}}
    />
  );
  return onShip;
}

describe("the ship picker", () => {
  it("lets the player pick the Lusitania; the others are coming soon", () => {
    const onShip = title("titanic");
    const titanic = screen.getByRole("radio", { name: /Ship: Titanic/ });
    const lusitania = screen.getByRole("radio", { name: /Ship: Lusitania/ });
    expect(titanic).toHaveAttribute("aria-checked", "true");
    expect(lusitania).toHaveAttribute("aria-checked", "false");
    expect(lusitania).toHaveTextContent("1915 · 240 m long");
    fireEvent.click(lusitania);
    expect(onShip).toHaveBeenCalledWith("lusitania");
    expect(screen.getByLabelText("Britannic: coming soon")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Edmund Fitzgerald: coming soon")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Lusitania: coming soon")).toBeNull();
  });

  it("words the Lusitania's afternoon and tells the grown-ups", () => {
    title("lusitania");
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      "This is the Lusitania in 1915. A torpedo sank her in 18 minutes during the First World War, and more than 1,190 people died. This game shows only the ship."
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real afternoon"
    );
    expect(screen.getByTestId("shipwreck-what-if")).toHaveAccessibleName(
      "What if? Choose where the torpedo hits"
    );
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import TitleScreen from "../TitleScreen";

function title(ship: "titanic" | "lusitania" | "fitzgerald") {
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
    expect(screen.queryByLabelText("Lusitania: coming soon")).toBeNull();
  });

  it("offers three ships, the Edmund Fitzgerald among them (1.3)", () => {
    const onShip = title("titanic");
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.dataset.testid)).toEqual([
      "shipwreck-ship-titanic",
      "shipwreck-ship-lusitania",
      "shipwreck-ship-fitzgerald",
    ]);
    const fitz = screen.getByRole("radio", { name: /Ship: Edmund Fitzgerald/ });
    expect(fitz).toHaveTextContent("1975 · 222 m long");
    fireEvent.click(fitz);
    expect(onShip).toHaveBeenCalledWith("fitzgerald");
    // Only the Britannic is still to come.
    expect(screen.getAllByText("Coming soon")).toHaveLength(1);
    expect(
      screen.queryByLabelText("Edmund Fitzgerald: coming soon")
    ).toBeNull();
  });

  it("words the Fitzgerald's storm and tells the grown-ups", () => {
    title("fitzgerald");
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      "This is the Edmund Fitzgerald, an ore carrier on Lake Superior. She sank in a storm on 10 November 1975, and all 29 of her crew died. This game shows only the ship."
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real storm"
    );
    expect(screen.getByTestId("shipwreck-what-if")).toHaveAccessibleName(
      "What if? Choose what lets the lake in, and the storm"
    );
  });

  it("words the Lusitania's afternoon and tells the grown-ups", () => {
    title("lusitania");
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      "This is the Lusitania in 1915. A torpedo sank her in 18 minutes during the First World War, and more than 1,190 people died. This game shows only the ship. You can walk her open decks."
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real afternoon"
    );
    expect(screen.getByTestId("shipwreck-what-if")).toHaveAccessibleName(
      "What if? Choose where torpedoes hit"
    );
  });
});

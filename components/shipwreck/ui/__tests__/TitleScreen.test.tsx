import { fireEvent, render, screen, within } from "@testing-library/react";
import { CARPATHIA_FUNNEL_PAINT } from "@/lib/shipwreck/ships/carpathia";
import TitleScreen from "../TitleScreen";

function title(
  ship:
    | "titanic"
    | "lusitania"
    | "fitzgerald"
    | "carpathia"
    | "britannic"
    | "concordia"
    | "poseidon"
) {
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
  it("lets the player pick the Lusitania", () => {
    const onShip = title("titanic");
    const titanic = screen.getByRole("radio", { name: /Ship: Titanic/ });
    const lusitania = screen.getByRole("radio", { name: /Ship: Lusitania/ });
    expect(titanic).toHaveAttribute("aria-checked", "true");
    expect(lusitania).toHaveAttribute("aria-checked", "false");
    expect(lusitania).toHaveTextContent("1915 · 240 m long");
    fireEvent.click(lusitania);
    expect(onShip).toHaveBeenCalledWith("lusitania");
    expect(screen.queryByLabelText("Lusitania: coming soon")).toBeNull();
  });

  it("offers every ship, the Edmund Fitzgerald among them (1.3)", () => {
    const onShip = title("titanic");
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.dataset.testid)).toEqual([
      "shipwreck-ship-titanic",
      "shipwreck-ship-lusitania",
      "shipwreck-ship-fitzgerald",
      "shipwreck-ship-carpathia",
      "shipwreck-ship-britannic",
      "shipwreck-ship-concordia",
      "shipwreck-ship-poseidon",
    ]);
    const fitz = screen.getByRole("radio", { name: /Ship: Edmund Fitzgerald/ });
    expect(fitz).toHaveTextContent("1975 · 222 m long");
    fireEvent.click(fitz);
    expect(onShip).toHaveBeenCalledWith("fitzgerald");
    expect(
      screen.queryByLabelText("Edmund Fitzgerald: coming soon")
    ).toBeNull();
  });

  it("offers the Britannic for real, and nothing is still to come (1.4)", () => {
    const onShip = title("titanic");
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.dataset.testid)).toEqual([
      "shipwreck-ship-titanic",
      "shipwreck-ship-lusitania",
      "shipwreck-ship-fitzgerald",
      "shipwreck-ship-carpathia",
      "shipwreck-ship-britannic",
      "shipwreck-ship-concordia",
      "shipwreck-ship-poseidon",
    ]);
    const brit = screen.getByRole("radio", { name: /Ship: Britannic/ });
    expect(brit).toHaveAccessibleName("Ship: Britannic, 1916, 269 metres long");
    expect(brit).toHaveTextContent("1916 · 269 m long");
    fireEvent.click(brit);
    expect(onShip).toHaveBeenCalledWith("britannic");
    expect(screen.queryByText("Coming soon")).toBeNull();
    expect(screen.queryByLabelText(/coming soon/)).toBeNull();
  });

  it("words the Britannic's morning, her mine, and tells the grown-ups", () => {
    title("britannic");
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      "This is the Britannic in 1916, a hospital ship in the First World War. A mine sank her in 55 minutes, and 30 people died. This game shows only the ship."
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real morning"
    );
    expect(screen.getByTestId("shipwreck-what-if")).toHaveAccessibleName(
      "What if? Choose where mines hit, and her portholes, doors and engines"
    );
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

  it("offers the Carpathia after the Fitzgerald, with a picture of her, and her morning", () => {
    const onShip = title("carpathia");
    const card = screen.getByRole("radio", { name: /Ship: Carpathia, 1918/ });
    expect(card).toHaveAttribute("aria-checked", "true");
    expect(card).toHaveTextContent("1918 · 170 m long");
    // Her picture: one funnel, in her 1918 grey.
    const pic = screen.getByTestId("shipwreck-ship-picture-carpathia");
    const funnels = pic.querySelectorAll("[data-funnel]");
    expect(funnels).toHaveLength(1);
    // Her 1918 funnel: dark battle grey.
    expect(funnels[0]).toHaveAttribute(
      "fill",
      `#${CARPATHIA_FUNNEL_PAINT.funnel.toString(16).padStart(6, "0")}`
    );
    expect(
      screen
        .getByTestId("shipwreck-ship-picture-titanic")
        .querySelectorAll("[data-funnel]")
    ).toHaveLength(4);
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      "This is the Carpathia, the ship that rescued the Titanic's survivors in 1912."
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real morning"
    );
    fireEvent.click(screen.getByRole("radio", { name: /Ship: Lusitania/ }));
    expect(onShip).toHaveBeenCalledWith("lusitania");
    // Nothing is still to come: the Britannic is offered too.
    expect(screen.queryAllByText("Coming soon")).toHaveLength(0);
  });
});

describe("the Costa Concordia's card (1.9)", () => {
  it("is the sixth card, with her picture, her night and the grown-ups' line", () => {
    const onShip = title("concordia");
    const card = screen.getByRole("radio", { name: /Ship: Costa Concordia/ });
    expect(card).toHaveAttribute("aria-checked", "true");
    expect(card).toHaveTextContent("2012 · 290 m long");
    expect(
      screen.getByTestId("shipwreck-ship-picture-concordia")
    ).toBeInTheDocument();
    // One yellow funnel, her Costa colours.
    const funnels = screen
      .getByTestId("shipwreck-ship-picture-concordia")
      .querySelectorAll("[data-funnel]");
    expect(funnels).toHaveLength(1);
    expect(funnels[0]).toHaveAttribute("fill", "#f2c230");
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      /^This is the Costa Concordia, a cruise ship, in January 2012\./
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The real night"
    );
    expect(screen.getByTestId("shipwreck-what-if")).toHaveAccessibleName(
      "What if? Choose where the rocks open the hull, and which way the wind blows"
    );
    fireEvent.click(screen.getByRole("radio", { name: /Ship: Titanic/ }));
    expect(onShip).toHaveBeenCalledWith("titanic");
  });
});

describe("the Poseidon's card (1.11)", () => {
  it("is the seventh, with a made-up mark and no year", () => {
    const onShip = title("titanic");
    const card = screen.getByRole("radio", { name: /Ship: Poseidon/ });
    expect(card).toHaveAccessibleName(
      "Ship: Poseidon, a made-up ship from a film, 305 metres long"
    );
    expect(card).toHaveTextContent("Made up · 305 m long");
    expect(card).not.toHaveTextContent(/2006/);
    expect(
      within(card).getByRole("img", { name: "A made-up ship from a film" })
    ).toBeInTheDocument();
    // Her side picture: one tall funnel, her hull, her boxes.
    expect(
      screen.getByTestId("shipwreck-ship-picture-poseidon")
    ).toBeInTheDocument();
    // No other card has the mark.
    expect(screen.getAllByRole("img")).toHaveLength(1);
    fireEvent.click(card);
    expect(onShip).toHaveBeenCalledWith("poseidon");
  });

  it("says what the What if is about, with a wave", () => {
    title("poseidon");
    expect(screen.getByTestId("shipwreck-what-if")).toHaveAccessibleName(
      "What if? Choose what the wave smashes, and how big the wave is"
    );
    expect(screen.getByTestId("shipwreck-real-night")).toHaveTextContent(
      "The big wave"
    );
    expect(screen.getByTestId("shipwreck-parent-line")).toHaveTextContent(
      /^The Poseidon is not a real ship/
    );
    const icon = screen
      .getByTestId("shipwreck-what-if")
      .querySelector("svg path")!;
    expect(icon.getAttribute("d")).toMatch(/^M2 20c3\.5/);
  });
});

describe("the wreck picker (any ship in any wreck)", () => {
  it("shows a picture card for every wreck, her own starred", () => {
    const onWreck = jest.fn();
    render(
      <TitleScreen
        ship="lusitania"
        onShip={() => {}}
        wreck="lusitania"
        onWreck={onWreck}
        onRealNight={() => {}}
        onWhatIf={() => {}}
      />
    );
    const group = screen.getByRole("radiogroup", {
      name: /Choose what happens to the Lusitania/,
    });
    expect(within(group).getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByTestId("shipwreck-wreck-real-lusitania")).toBeTruthy();
    expect(screen.queryByTestId("shipwreck-wreck-real-titanic")).toBeNull();
    expect(
      screen
        .getByTestId("shipwreck-wreck-lusitania")
        .getAttribute("aria-checked")
    ).toBe("true");
    fireEvent.click(screen.getByTestId("shipwreck-wreck-fitzgerald"));
    expect(onWreck).toHaveBeenCalledWith("fitzgerald");
  });

  it("plays another ship's wreck with a Play button", () => {
    render(
      <TitleScreen
        ship="titanic"
        onShip={() => {}}
        wreck="fitzgerald"
        onWreck={() => {}}
        onRealNight={() => {}}
        onWhatIf={() => {}}
      />
    );
    const play = screen.getByTestId("shipwreck-real-night");
    expect(play.textContent).toBe("Play");
    expect(play.getAttribute("aria-label")).toMatch(
      /Titanic meets a snow storm on Lake Superior/
    );
    expect(screen.getByTestId("shipwreck-parent-line").textContent).toMatch(
      /Here the Titanic takes her place/
    );
  });
});

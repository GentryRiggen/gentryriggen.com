import { PLAYABLE_UNIVERSES } from "@/lib/ever-onward/universes";
import LampPanel from "../../game/LampPanel";
import FundPanel from "../../game/FundPanel";
import MemoryGarden from "../../game/MemoryGarden";
import ProbeRaces from "../../game/ProbeRaces";
import TideClock from "../../game/TideClock";
import ProjectsPanel from "../../game/ProjectsPanel";
import StreetlightsPanel from "../../game/StreetlightsPanel";
import WeatherDesk from "../../game/WeatherDesk";
import { uiFor } from "..";

describe("the universe UI registry", () => {
  it("has a UI for every playable universe", () => {
    for (const def of PLAYABLE_UNIVERSES)
      expect(() => uiFor(def.id)).not.toThrow();
  });

  it("keeps Light's side panels in today's order", () => {
    // The fork is the same panel in every part, but the Coast's sits at the top
    // (with the lamp) and the others stay here, in the same place as before.
    const { panels, topPanels } = uiFor("light");
    expect(panels[0].name).toBe("LaterForkPanel");
    expect(topPanels).toHaveLength(2);
    expect(topPanels?.[0].name).toBe("CoastForkPanel");
    expect(topPanels?.[1]).toBe(LampPanel);
    expect(panels.slice(1)).toEqual([
      FundPanel,
      TideClock,
      ProbeRaces,
      StreetlightsPanel,
      WeatherDesk,
      ProjectsPanel,
      MemoryGarden,
    ]);
  });

  it("keeps Light's ending lines", () => {
    expect(uiFor("light").ending.storyIds).toEqual([
      "last-remember",
      "last-end-1",
      "last-end-2",
    ]);
  });

  it("gives Light a lantern opening and four tap looks", () => {
    expect(uiFor("light").Opening).toBeDefined();
    expect(uiFor("light").tapLooks).toHaveLength(4);
  });

  it("throws for an unknown universe", () => {
    expect(() => uiFor("nope")).toThrow("No UI for universe nope");
  });
});

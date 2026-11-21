import { render, screen } from "@testing-library/react";
import { getCommandResponse } from "../commandResponses";

describe("planes command", () => {
  it.each(["planes", "plane-builder", "PLANES"])(
    "responds to %s with a blurb, a link, and a navigation target",
    (input) => {
      const result = getCommandResponse(input, []);
      render(<>{result.output}</>);

      expect(
        screen.getByText(/A plane-flying game I made for my boys/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /\/plane-builder/ })
      ).toHaveAttribute("href", "/plane-builder");
      expect(result.navigateTo).toBe("/plane-builder");
      expect(result.shouldClear).toBe(false);
    }
  );

  it("describes the series, not only the lighthouse", () => {
    const result = getCommandResponse("onward", []);
    render(<>{result.output}</>);
    expect(screen.getByText(/series of incremental games/)).toBeInTheDocument();
  });

  it("is listed in help", () => {
    const result = getCommandResponse("help", []);
    expect(result.output).toEqual(expect.stringMatching(/^\s+planes\s/m));
  });
});

describe("planets command", () => {
  it.each(["planets", "planet-smasher", "smash", "PLANETS"])(
    "responds to %s with a blurb, a link, and a navigation target",
    (input) => {
      const result = getCommandResponse(input, []);
      render(<>{result.output}</>);

      expect(
        screen.getByText(/A planet-smashing game I made for my boys/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /\/planet-smasher/ })
      ).toHaveAttribute("href", "/planet-smasher");
      expect(result.navigateTo).toBe("/planet-smasher");
      expect(result.shouldClear).toBe(false);
    }
  );

  it("is listed in help", () => {
    const result = getCommandResponse("help", []);
    expect(result.output).toEqual(expect.stringMatching(/^\s+planets\s/m));
  });
});

describe("flamelings command", () => {
  it.each(["flamelings", "pets", "FLAMELINGS"])(
    "responds to %s with a blurb, a link, and a navigation target",
    (input) => {
      const result = getCommandResponse(input, []);
      render(<>{result.output}</>);

      expect(
        screen.getByText(/A little flame pet I made for my boys/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /\/flamelings/ })
      ).toHaveAttribute("href", "/flamelings");
      expect(result.navigateTo).toBe("/flamelings");
    }
  );

  it("is listed in help", () => {
    const result = getCommandResponse("help", []);
    expect(result.output).toEqual(expect.stringMatching(/^\s+flamelings\s/m));
  });
});

describe("shipwreck command", () => {
  it.each(["shipwreck", "titanic", "SHIPWRECK"])(
    "responds to %s with a blurb, a link, and a navigation target",
    (input) => {
      const result = getCommandResponse(input, []);
      render(<>{result.output}</>);

      expect(
        screen.getByText(/A realistic sinking-ship simulator/)
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /\/shipwreck/ })).toHaveAttribute(
        "href",
        "/shipwreck"
      );
      expect(result.navigateTo).toBe("/shipwreck");
    }
  );

  it("is listed in help", () => {
    const result = getCommandResponse("help", []);
    expect(result.output).toEqual(expect.stringMatching(/^\s+shipwreck\s/m));
  });
});

describe("ever onward command", () => {
  it.each([
    "onward",
    "ever-onward",
    "ever onward",
    "ONWARD",
    "machines",
    "little-machines",
    "little machines",
  ])(
    "responds to %s with a blurb, a link, and a navigation target",
    (input) => {
      const result = getCommandResponse(input, []);
      render(<>{result.output}</>);

      expect(screen.getByText(/Ever Onward/)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /\/ever-onward/ })
      ).toHaveAttribute("href", "/ever-onward");
      expect(result.navigateTo).toBe("/ever-onward");
      expect(result.shouldClear).toBe(false);
    }
  );

  it("is listed in help", () => {
    const result = getCommandResponse("help", []);
    expect(result.output).toEqual(expect.stringMatching(/^\s+onward\s/m));
  });
});

describe("ships command", () => {
  it.each(["ships", "ship-builder", "SHIPS"])(
    "responds to %s with a blurb, a link, and a navigation target",
    (input) => {
      const result = getCommandResponse(input, []);
      render(<>{result.output}</>);

      expect(
        screen.getByText(/A ship-building game I made for my boys/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /\/ship-builder/ })
      ).toHaveAttribute("href", "/ship-builder");
      expect(result.navigateTo).toBe("/ship-builder");
      expect(result.shouldClear).toBe(false);
    }
  );

  it("does not set navigateTo for other commands", () => {
    expect(getCommandResponse("pwd", []).navigateTo).toBeUndefined();
  });

  it("is listed in help", () => {
    const result = getCommandResponse("help", []);
    expect(result.output).toEqual(expect.stringMatching(/^\s+ships\s/m));
  });
});

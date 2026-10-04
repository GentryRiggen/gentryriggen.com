import { render, screen } from "@testing-library/react";
import { getCommandResponse } from "../commandResponses";

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

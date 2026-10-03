import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Drawer from "../Drawer";

function renderDrawer() {
  render(
    <Drawer side="right" label="Stats">
      <button type="button">Inside</button>
    </Drawer>
  );
  return {
    toggle: screen.getByRole("button", { name: "Stats" }),
    aside: screen.getByLabelText("Stats", { selector: "aside" }),
  };
}

describe("Drawer", () => {
  it("flips aria-expanded on the toggle", async () => {
    const user = userEvent.setup();
    const { toggle } = renderDrawer();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("hides the closed drawer from focus and assistive tech", async () => {
    const user = userEvent.setup();
    const { toggle, aside } = renderDrawer();
    expect(aside).toHaveClass("invisible");
    await user.click(toggle);
    expect(aside).not.toHaveClass("invisible");
    expect(aside).toHaveClass("visible");
  });

  it("closes from the close button", async () => {
    const user = userEvent.setup();
    const { toggle, aside } = renderDrawer();
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Close Stats" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(aside).toHaveClass("invisible");
  });
});

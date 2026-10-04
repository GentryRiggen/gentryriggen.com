import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Drawer from "../Drawer";

function StatefulDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <Drawer side="right" label="Stats" open={open} onOpenChange={setOpen}>
      <button type="button">Inside</button>
    </Drawer>
  );
}

function renderDrawer() {
  render(<StatefulDrawer />);
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
    expect(toggle).toHaveFocus();
  });

  describe("collapsing at lg", () => {
    function renderCollapsible(initial = false) {
      function Harness() {
        const [collapsed, setCollapsed] = useState(initial);
        return (
          <Drawer
            side="left"
            label="Parts"
            open={false}
            onOpenChange={() => {}}
            collapsed={collapsed}
            onCollapsedChange={() => setCollapsed((c) => !c)}
          >
            <button type="button">Inside</button>
          </Drawer>
        );
      }
      render(<Harness />);
      return screen.getByLabelText("Parts", { selector: "aside" });
    }

    it("collapses to a rail and expands again", async () => {
      const user = userEvent.setup();
      const aside = renderCollapsible();
      const collapse = screen.getByRole("button", { name: "Collapse Parts" });
      expect(collapse).toHaveAttribute("aria-expanded", "true");
      expect(collapse).toHaveClass("hidden", "lg:inline-flex");
      expect(aside).not.toHaveClass("lg:w-10");

      await user.click(collapse);
      expect(aside).toHaveClass("lg:w-10");
      expect(screen.getByTestId("drawer-content-Parts")).toHaveClass(
        "lg:hidden"
      );
      const expand = screen.getByRole("button", { name: "Expand Parts" });
      expect(expand).toHaveAttribute("aria-expanded", "false");

      await user.click(expand);
      expect(aside).not.toHaveClass("lg:w-10");
      expect(
        screen.getByRole("button", { name: "Collapse Parts" })
      ).toBeInTheDocument();
    });

    it("renders the collapsed rail only at lg", () => {
      renderCollapsible(true);
      expect(screen.getByRole("button", { name: "Expand Parts" })).toHaveClass(
        "hidden",
        "lg:flex"
      );
    });
  });
});

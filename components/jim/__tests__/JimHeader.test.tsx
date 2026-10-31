import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JimHeader from "../JimHeader";

it("shows the Chat | Notes switch and reports the tab picked", async () => {
  const onTab = jest.fn();
  render(<JimHeader onSignOut={jest.fn()} tab="chat" onTab={onTab} />);
  const tabs = within(screen.getByRole("tablist", { name: "Jim" }));
  expect(tabs.getByRole("tab", { name: "Chat" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(tabs.getByRole("tab", { name: "Notes" })).toHaveAttribute(
    "aria-controls",
    "jim-notes"
  );
  await userEvent.click(tabs.getByRole("tab", { name: "Notes" }));
  expect(onTab).toHaveBeenCalledWith("notes");
});

it("has no switch without tabs", () => {
  render(<JimHeader onSignOut={jest.fn()} />);
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
});

it("keeps Sign out in a menu, after any other items", async () => {
  const onSignOut = jest.fn();
  const onRefresh = jest.fn();
  render(
    <JimHeader
      onSignOut={onSignOut}
      menuItems={[{ label: "Refresh", onSelect: onRefresh }]}
    />
  );
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  const menuButton = screen.getByRole("button", { name: "Menu" });
  await userEvent.click(menuButton);
  expect(menuButton).toHaveAttribute("aria-expanded", "true");
  const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
  expect(items.map((i) => i.textContent)).toEqual(["Refresh", "Sign out"]);
  expect(items[0]).toHaveFocus();

  await userEvent.click(items[0]);
  expect(onRefresh).toHaveBeenCalled();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();

  await userEvent.click(menuButton);
  await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  expect(onSignOut).toHaveBeenCalled();
});

it("closes the menu on Escape or a tap outside", async () => {
  render(
    <div>
      <JimHeader onSignOut={jest.fn()} />
      <p>Outside</p>
    </div>
  );
  const menuButton = screen.getByRole("button", { name: "Menu" });
  await userEvent.click(menuButton);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(menuButton).toHaveFocus();

  await userEvent.click(menuButton);
  await userEvent.click(screen.getByText("Outside"));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

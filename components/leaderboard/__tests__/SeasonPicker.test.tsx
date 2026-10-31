import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SeasonPicker from "../SeasonPicker";

it("lists the seasons from now back to the first", () => {
  render(<SeasonPicker current={3} value={3} onChange={jest.fn()} />);
  const select = screen.getByRole("combobox", { name: "Season" });
  expect(
    within(select)
      .getAllByRole("option")
      .map((option) => option.textContent)
  ).toEqual(["Season 3 (now)", "Season 2", "Season 1"]);
  expect(select).toHaveValue("3");
});

it("calls onChange with the chosen season", async () => {
  const onChange = jest.fn();
  render(<SeasonPicker current={3} value={3} onChange={onChange} />);
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Season" }),
    "2"
  );
  expect(onChange).toHaveBeenCalledWith(2);
});

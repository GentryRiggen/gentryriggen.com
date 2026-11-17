import { act, fireEvent, render, screen } from "@testing-library/react";
import { setNow, resetClock } from "@/lib/flamelings/clock";
import { SAVE_KEY } from "@/lib/flamelings/save";
import { useFlamelings } from "@/lib/flamelings/store";
import Flamelings from "../Flamelings";
import FireflyCatch from "../FireflyCatch";

jest.mock("canvas-confetti", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));

const NOON = new Date(2026, 10, 17, 12).getTime();

function reset() {
  window.localStorage.clear();
  resetClock();
  setNow(NOON);
  useFlamelings.setState(useFlamelings.getInitialState(), true);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOON, advanceTimers: true });
  reset();
});
afterEach(() => {
  jest.useRealTimers();
  resetClock();
});

function hatchThroughUi(name: string) {
  fireEvent.click(screen.getByTestId("hatch-new"));
  for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("egg"));
  fireEvent.click(screen.getByRole("button", { name: "Hello, little flame!" }));
  fireEvent.change(screen.getByLabelText("Name your flameling"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Welcome home!" }));
}

describe("Flamelings", () => {
  it("starts on an empty shelf with a way to hatch", () => {
    render(<Flamelings />);
    expect(screen.getByTestId("hatch-new")).toBeInTheDocument();
    expect(screen.queryByTestId("pet-card")).toBeNull();
    expect(screen.getByRole("link", { name: /What's new/ })).toHaveAttribute(
      "href",
      "/flamelings/versions"
    );
  });

  it("hatches, names and saves a pet, limiting names to 12 characters", () => {
    render(<Flamelings />);
    fireEvent.click(screen.getByTestId("hatch-new"));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("egg"));
    fireEvent.click(
      screen.getByRole("button", { name: "Hello, little flame!" })
    );
    const input = screen.getByLabelText("Name your flameling");
    expect(input).toHaveAttribute("maxLength", "12");
    expect(
      screen.getByRole("button", { name: "Welcome home!" })
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: "Sparky" } });
    fireEvent.click(screen.getByRole("button", { name: "Welcome home!" }));
    expect(
      screen.getByRole("button", { name: /Sparky, tap to say hi/ })
    ).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? "{}");
    expect(saved.pets).toHaveLength(1);
    expect(saved.pets[0].name).toBe("Sparky");
  });

  it("fills the name from the dice", () => {
    render(<Flamelings />);
    fireEvent.click(screen.getByTestId("hatch-new"));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId("egg"));
    fireEvent.click(
      screen.getByRole("button", { name: "Hello, little flame!" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Pick a random name" }));
    const input = screen.getByLabelText(
      "Name your flameling"
    ) as HTMLInputElement;
    expect(input.value.length).toBeGreaterThan(0);
    expect(input.value.length).toBeLessThanOrEqual(12);
  });

  it("feeds a hungry pet after the food flies in", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    act(() => {
      const { save } = useFlamelings.getState();
      useFlamelings.setState({
        save: { ...save, pets: [{ ...save.pets[0], fuel: 20 }] },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    act(() => {
      jest.advanceTimersByTime(700);
    });
    expect(useFlamelings.getState().save.pets[0].fuel).toBeGreaterThan(55);
    expect(screen.getByTestId("pet")).toHaveAttribute("data-mood", "eating");
  });

  it("disables feeding and playing at night", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    act(() => {
      setNow(new Date(2026, 10, 17, 22).getTime());
      useFlamelings.getState().tick();
    });
    expect(screen.getByRole("button", { name: "Feed" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Wardrobe" })).toBeEnabled();
    expect(screen.getByTestId("asleep-hint")).toBeInTheDocument();
  });

  it("shows locked wardrobe items with a lock and equips owned ones", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    fireEvent.click(screen.getByRole("button", { name: "Wardrobe" }));
    expect(
      screen.getByRole("button", { name: /Rose, locked, Level/ })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Sky" }));
    expect(useFlamelings.getState().save.pets[0].look.colour).toBe("sky");
    fireEvent.click(screen.getByRole("tab", { name: /Hat/ }));
    expect(
      screen.getByRole("button", { name: /Crown, locked/ })
    ).toBeDisabled();
  });

  it("opens the present into a NEW! card", () => {
    render(<Flamelings />);
    hatchThroughUi("Pip");
    fireEvent.click(screen.getByTestId("gift"));
    expect(
      screen.getByRole("dialog", { name: "A surprise!" })
    ).toBeInTheDocument();
    expect(screen.getByText("NEW!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yay!" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByTestId("gift")).toBeNull();
  });

  it("recovers from a corrupt save", () => {
    window.localStorage.setItem(SAVE_KEY, "{oops");
    render(<Flamelings />);
    expect(screen.getByTestId("hatch-new")).toBeInTheDocument();
    expect(window.localStorage.getItem("flamelings:v1:corrupt")).toBe("{oops");
  });
});

describe("FireflyCatch", () => {
  it("counts catches for 20 seconds, then hands the score over", () => {
    const onDone = jest.fn();
    render(<FireflyCatch onDone={onDone} />);
    const flies = screen.getAllByRole("button", { name: "Catch a firefly" });
    fireEvent.click(flies[0]);
    fireEvent.click(flies[1]);
    expect(screen.getByTestId("catch-score")).toHaveTextContent("2");
    act(() => {
      jest.advanceTimersByTime(20_500);
    });
    expect(screen.getByText("You caught 2 fireflies!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith(2);
  });
});

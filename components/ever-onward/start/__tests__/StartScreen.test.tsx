import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SEASONS } from "@/lib/ever-onward/season";
import StartScreen from "../StartScreen";

const autumn = SEASONS[0];

describe("StartScreen", () => {
  it("offers START to a new player", () => {
    render(<StartScreen hasSave={false} startedIds={[]} onStart={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ever Onward" })
    ).toBeInTheDocument();
  });

  it("offers CONTINUE when a game exists, and lights its universe", () => {
    render(<StartScreen hasSave startedIds={["light"]} onStart={jest.fn()} />);
    expect(
      screen.getByRole("button", { name: "Continue" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Keep the Light On, lit/)).toBeInTheDocument();
  });

  it("starts once on click, Enter or Space", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    const { unmount } = render(
      <StartScreen hasSave={false} startedIds={[]} onStart={onStart} />
    );
    await user.keyboard("{Enter}");
    expect(onStart).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onStart).toHaveBeenCalledTimes(1);
    unmount();

    const again = jest.fn();
    render(<StartScreen hasSave={false} startedIds={[]} onStart={again} />);
    await user.keyboard(" ");
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("starts once when the focused button is activated by keyboard", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    render(<StartScreen hasSave={false} startedIds={[]} onStart={onStart} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("starts when tapping the background but not the footer links", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();
    render(<StartScreen hasSave={false} startedIds={[]} onStart={onStart} />);
    await user.click(screen.getByRole("link", { name: /what's new/ }));
    expect(onStart).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("eo-start"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("dresses the robot for the season", () => {
    render(
      <StartScreen
        hasSave={false}
        startedIds={[]}
        onStart={jest.fn()}
        season={autumn}
      />
    );
    expect(screen.getByTestId("eo-robot")).toHaveAttribute(
      "data-season",
      "autumn"
    );
  });
});

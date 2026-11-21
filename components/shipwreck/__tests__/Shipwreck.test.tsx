import { act, fireEvent, render, screen } from "@testing-library/react";
import { SAVE_KEY } from "@/lib/shipwreck/save";
import { resetSaveStore } from "@/lib/shipwreck/useSave";
import Shipwreck from "../Shipwreck";

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));
jest.mock("@/components/update/useUpdateCheck", () => ({
  useUpdateCheck: () => ({ isUpdateReady: false }),
}));

beforeEach(() => {
  window.localStorage.clear();
  resetSaveStore();
});

describe("Shipwreck title screen", () => {
  it("shows the title, the parent line and a What's new link", () => {
    render(<Shipwreck />);
    expect(
      screen.getByRole("heading", { name: "Shipwreck" })
    ).toBeInTheDocument();
    expect(screen.getByText(/More than 1,500 people died/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /What's new/ })).toHaveAttribute(
      "href",
      "/shipwreck/versions"
    );
  });

  it("says the game is coming soon", () => {
    render(<Shipwreck />);
    expect(screen.getByTestId("shipwreck-coming-soon")).toHaveTextContent(
      "Check back soon"
    );
    expect(
      screen.getByRole("img", { name: "The Titanic sinking at night" })
    ).toBeInTheDocument();
  });

  it("exposes the screen to test hooks", () => {
    render(<Shipwreck />);
    expect(window.__shipwreck?.getScreen()).toBe("title");
  });

  it("saves when the page is hidden", () => {
    render(<Shipwreck />);
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      fireEvent(document, new Event("visibilitychange"));
    });
    expect(window.localStorage.getItem(SAVE_KEY)).not.toBeNull();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });
});

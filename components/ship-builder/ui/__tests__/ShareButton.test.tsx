import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShareButton from "../ShareButton";

describe("ShareButton", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
  });

  it("copies the link and shows it", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ShareButton />);
    // userEvent.setup() installs its own clipboard stub, so override it afterwards.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "Share" }));
    const input = screen.getByLabelText("Share link URL") as HTMLInputElement;
    expect(input.value).toMatch(/\/ship-builder#ship=/);
    expect(writeText).toHaveBeenCalledWith(input.value);
    expect(
      await screen.findByText("Link copied to clipboard")
    ).toBeInTheDocument();
  });

  it("still shows the link without clipboard access", async () => {
    const user = userEvent.setup();
    render(<ShareButton />);
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByLabelText("Share link URL")).toBeInTheDocument();
    expect(
      await screen.findByText("Copy this link to share your ship")
    ).toBeInTheDocument();
  });
});

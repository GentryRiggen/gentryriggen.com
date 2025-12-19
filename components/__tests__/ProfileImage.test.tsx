import { render, screen, fireEvent } from "@testing-library/react";
import ProfileImage from "../ProfileImage";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill, // eslint-disable-line @typescript-eslint/no-unused-vars
    priority: _priority, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...props
  }: React.ComponentPropsWithoutRef<"img"> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

describe("ProfileImage", () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  it("renders the image with correct alt text", () => {
    render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={false}
        isCooldown={false}
      />
    );
    const image = screen.getByAltText("Gentry Riggen");
    expect(image).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={false}
        isCooldown={false}
      />
    );
    const imageContainer = screen.getByRole("button");
    fireEvent.click(imageContainer);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClick when Enter key is pressed", () => {
    render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={false}
        isCooldown={false}
      />
    );
    const imageContainer = screen.getByRole("button");
    fireEvent.keyDown(imageContainer, { key: "Enter" });
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClick when Space key is pressed", () => {
    render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={false}
        isCooldown={false}
      />
    );
    const imageContainer = screen.getByRole("button");
    fireEvent.keyDown(imageContainer, { key: " " });
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick for other keys", () => {
    render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={false}
        isCooldown={false}
      />
    );
    const imageContainer = screen.getByRole("button");
    fireEvent.keyDown(imageContainer, { key: "Tab" });
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("applies bounce animation class when isBouncing is true and not in cooldown", () => {
    const { container } = render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={true}
        isCooldown={false}
      />
    );
    const imageContainer = container.querySelector('[role="button"]');
    expect(imageContainer).toHaveClass("animate-bounce-click");
  });

  it("applies shake animation class when isBouncing is true and in cooldown", () => {
    const { container } = render(
      <ProfileImage onClick={mockOnClick} isBouncing={true} isCooldown={true} />
    );
    const imageContainer = container.querySelector('[role="button"]');
    expect(imageContainer).toHaveClass("animate-shake-no");
  });

  it("does not apply animation classes when not bouncing", () => {
    const { container } = render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={false}
        isCooldown={false}
      />
    );
    const imageContainer = container.querySelector('[role="button"]');
    expect(imageContainer).not.toHaveClass("animate-bounce-click");
    expect(imageContainer).not.toHaveClass("animate-shake-no");
  });

  it("has proper accessibility attributes", () => {
    render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={false}
        isCooldown={false}
      />
    );
    const imageContainer = screen.getByRole("button");
    expect(imageContainer).toHaveAttribute(
      "aria-label",
      "Click me three times for a surprise!"
    );
    expect(imageContainer).toHaveAttribute("tabIndex", "0");
  });

  it("has cursor pointer and hover styles", () => {
    const { container } = render(
      <ProfileImage
        onClick={mockOnClick}
        isBouncing={false}
        isCooldown={false}
      />
    );
    const imageContainer = container.querySelector('[role="button"]');
    expect(imageContainer).toHaveClass("cursor-pointer");
    expect(imageContainer).toHaveClass("hover:scale-105");
  });
});

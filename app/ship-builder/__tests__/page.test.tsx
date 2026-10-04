import { render, screen } from "@testing-library/react";
import ShipBuilderPage, { metadata } from "../page";

jest.mock("@/components/ship-builder/ShipBuilder", () => ({
  __esModule: true,
  default: function ShipBuilderStub() {
    return <div data-testid="ship-builder" />;
  },
}));

describe("ship-builder route", () => {
  it("renders the ship builder", () => {
    render(<ShipBuilderPage />);
    expect(screen.getByTestId("ship-builder")).toBeInTheDocument();
  });

  it("sets the page title and canonical URL", () => {
    expect(metadata.title).toBe("Ship Builder | Gentry Riggen");
    expect(metadata.alternates?.canonical).toBe(
      "https://gentryriggen.com/ship-builder"
    );
  });
});

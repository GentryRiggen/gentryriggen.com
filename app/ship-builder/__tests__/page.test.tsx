import { render, screen } from "@testing-library/react";
import ShipBuilderPage, { metadata, viewport } from "../page";

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

  it("links the home-screen app manifest and iOS web-app metadata", () => {
    expect(metadata.manifest).toBe("/ship-builder.webmanifest");
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      title: "Ship Builder",
      statusBarStyle: "black-translucent",
    });
    // Next only emits mobile-web-app-capable; older iOS needs the apple- one.
    expect(metadata.other).toEqual({ "apple-mobile-web-app-capable": "yes" });
    // Page icons replace the layout's, so the favicon is repeated here.
    expect(metadata.icons).toEqual({
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: [
        {
          url: "/ship-builder-icons/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    });
  });

  it("uses the sea-blue theme colour", () => {
    expect(viewport.themeColor).toBe("#1f4e6e");
  });
});

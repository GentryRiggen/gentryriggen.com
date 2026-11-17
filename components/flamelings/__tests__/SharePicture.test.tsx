import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createPet } from "@/lib/flamelings/actions";
import { shareOrDownload, svgToPng } from "@/lib/flamelings/shareImage";
import SharePicture from "../SharePicture";

jest.mock("@/lib/flamelings/analytics", () => ({ trackShare: jest.fn() }));
jest.mock("@/lib/flamelings/shareImage", () => ({
  petMarkupOf: () => "<circle/>",
  svgToPng: jest.fn(),
  shareOrDownload: jest.fn(),
  canShareFile: () => false,
  SHARE_FILE_NAME: "my-flameling.png",
}));

const NOW = Date.UTC(2026, 10, 17, 12);

function renderPicture() {
  const pet = createPet({
    id: "p1",
    name: "Pip",
    look: { colour: "ember", shape: "flame", eyes: "round" },
    now: NOW,
  } as Parameters<typeof createPet>[0]);
  render(<SharePicture pet={pet} nowMs={NOW} onClose={() => {}} />);
}

beforeEach(() => {
  URL.createObjectURL = jest.fn(() => "blob:picture");
  URL.revokeObjectURL = jest.fn();
  (svgToPng as jest.Mock).mockResolvedValue(new Blob(["x"]));
});

describe("SharePicture", () => {
  it("after a download, shows the press-and-hold hint and never says saved", async () => {
    (shareOrDownload as jest.Mock).mockResolvedValue("download");
    renderPicture();
    await waitFor(() =>
      expect(screen.getByTestId("share-button")).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId("share-button"));
    expect(await screen.findByTestId("share-hold-hint")).toBeInTheDocument();
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("share-image")).toBeInTheDocument();
  });

  it("after the share sheet, shows no hint", async () => {
    (shareOrDownload as jest.Mock).mockResolvedValue("share");
    renderPicture();
    await waitFor(() =>
      expect(screen.getByTestId("share-button")).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId("share-button"));
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalled());
    expect(screen.queryByTestId("share-hold-hint")).not.toBeInTheDocument();
  });
});

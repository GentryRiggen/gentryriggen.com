import { gameIconPaths, gameMetadata } from "../metadata";

const options = {
  slug: "pip-game",
  title: "Pip Game",
  description: "A game about Pip.",
  themeColor: "#112233",
  statusBar: "black",
} as const;

describe("gameMetadata", () => {
  const { metadata, viewport } = gameMetadata(options);

  it("links its own manifest and canonical url", () => {
    expect(metadata.manifest).toBe("/pip-game.webmanifest");
    expect(metadata.alternates?.canonical).toBe(
      "https://gentryriggen.com/pip-game"
    );
    expect(metadata.title).toBe("Pip Game | Gentry Riggen");
  });

  it("is a home-screen app with the status bar style it was given", () => {
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      title: "Pip Game",
      statusBarStyle: "black",
    });
    expect(metadata.other).toEqual({ "apple-mobile-web-app-capable": "yes" });
    expect(
      gameMetadata({ ...options, statusBar: "black-translucent" }).metadata
        .appleWebApp
    ).toMatchObject({ statusBarStyle: "black-translucent" });
  });

  it("uses a versioned apple icon, since iOS caches icons by URL", () => {
    expect(gameIconPaths("pip-game", 3).apple).toBe(
      "/pip-game-icons/apple-touch-icon-v3.png"
    );
    expect(gameIconPaths("pip-game").apple).toMatch(/-v1\.png$/);
    expect(metadata.icons).toMatchObject({
      apple: [
        { url: "/pip-game-icons/apple-touch-icon-v1.png", sizes: "180x180" },
      ],
    });
  });

  it("runs edge to edge and blocks zoom unless asked", () => {
    expect(viewport).toMatchObject({
      themeColor: "#112233",
      viewportFit: "cover",
      initialScale: 1,
      maximumScale: 1,
      userScalable: false,
    });
    const zoomable = gameMetadata({ ...options, allowZoom: true }).viewport;
    expect(zoomable.maximumScale).toBeUndefined();
    expect(zoomable.userScalable).toBeUndefined();
  });
});

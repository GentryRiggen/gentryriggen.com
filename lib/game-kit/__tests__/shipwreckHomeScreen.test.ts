import fs from "fs";
import path from "path";
import { gameIconPaths } from "../metadata";

const ROOT = path.join(__dirname, "../../..");

describe("Shipwreck home-screen files", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "public/shipwreck.webmanifest"), "utf8")
  );
  const icons = gameIconPaths("shipwreck", 1);

  it("ships every versioned icon the page and manifest name", () => {
    for (const url of Object.values(icons)) {
      expect(fs.existsSync(path.join(ROOT, "public", url))).toBe(true);
    }
  });

  it("lists exactly those icons in its manifest", () => {
    const srcs = manifest.icons.map((i: { src: string }) => i.src).sort();
    expect(srcs).toEqual([icons.icon192, icons.icon512, icons.maskable].sort());
  });

  it("stays within its own scope", () => {
    expect(manifest.start_url).toBe("/shipwreck");
    expect(manifest.scope).toBe("/shipwreck");
  });
});

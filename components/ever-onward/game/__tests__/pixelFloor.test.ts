import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : sources(path);
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("pixel font floor", () => {
  it("has no 8 px or 9 px text anywhere in Ever Onward", () => {
    const bad = sources(ROOT).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, i) =>
          /text-\[(8|9)px\]/.test(line)
            ? [`${file.slice(ROOT.length + 1)}:${i + 1}`]
            : []
        )
    );
    expect(bad).toEqual([]);
  });

  it("has no 11 px text in the game panels", () => {
    const bad = sources(join(ROOT, "game")).filter((file) =>
      /text-\[11px\]/.test(readFileSync(file, "utf8"))
    );
    expect(bad).toEqual([]);
  });
});

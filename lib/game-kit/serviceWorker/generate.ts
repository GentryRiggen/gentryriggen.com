import { readFileSync } from "node:fs";
import path from "node:path";

export interface GameServiceWorkerConfig {
  /** URL slug: the page is `/<slug>`, the worker `public/<slug>-sw.js`. */
  slug: string;
  /** Display name for the file's header comment. */
  title: string;
  /** Folders of non-content-hashed assets, e.g. "/flamelings-icons/". */
  assetPrefixes: readonly string[];
  /** Single non-content-hashed files, e.g. "/flamelings.webmanifest". */
  assetPaths: readonly string[];
}

/** Every game whose `public/<slug>-sw.js` comes from the shared template. */
export const GENERATED_GAME_WORKERS: readonly GameServiceWorkerConfig[] = [
  {
    slug: "flamelings",
    title: "Flamelings",
    assetPrefixes: ["/flamelings-icons/"],
    assetPaths: ["/flamelings.webmanifest"],
  },
];

/** The file's path inside `public/`, which is also its URL. */
export function workerFileName(slug: string): string {
  return `${slug}-sw.js`;
}

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "lib/game-kit/serviceWorker/template.sw.txt"
);

/** An array literal as Prettier would print it (80 columns, double quotes). */
function arrayLiteral(values: readonly string[], indent: string): string {
  if (values.length === 0) return "[]";
  const inline = `[${values.map((v) => JSON.stringify(v)).join(", ")}]`;
  if (indent.length + "const ASSET_PREFIXES = ".length + inline.length < 79) {
    return inline;
  }
  const items = values.map((v) => `  ${JSON.stringify(v)},`).join("\n");
  return `[\n${items}\n]`;
}

function assertSafe(config: GameServiceWorkerConfig): void {
  if (!/^[a-z][a-z0-9-]*$/.test(config.slug)) {
    throw new Error(`Bad slug: ${config.slug}`);
  }
  for (const value of [...config.assetPrefixes, ...config.assetPaths]) {
    if (!value.startsWith(`/${config.slug}`)) {
      throw new Error(`${value} is outside /${config.slug}`);
    }
  }
}

/** Renders a game's worker from the template; only these constants differ. */
export function renderGameServiceWorker(
  config: GameServiceWorkerConfig
): string {
  assertSafe(config);
  const values: Record<string, string> = {
    SLUG: config.slug,
    TITLE: config.title,
    ASSET_PREFIXES: arrayLiteral(config.assetPrefixes, ""),
    ASSET_PATHS: arrayLiteral(config.assetPaths, ""),
  };
  return readFileSync(TEMPLATE_PATH, "utf8").replace(
    /\{\{([A-Z_]+)\}\}/g,
    (_match, key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Unknown token ${key}`);
      return value;
    }
  );
}

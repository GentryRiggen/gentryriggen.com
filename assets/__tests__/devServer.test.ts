import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as devServer from "../../scripts/assets/devServer.mjs";

const {
  assertPortFree,
  freePort,
  nextDevArgs,
  pickPort,
  usesSymlinkedModules,
} = devServer as {
  assertPortFree: (port: number) => Promise<void>;
  freePort: () => Promise<number>;
  nextDevArgs: (root: string, port: number) => string[];
  pickPort: (env?: Record<string, string>) => Promise<number>;
  usesSymlinkedModules: (root: string) => boolean;
};

function listen(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      resolve({
        server,
        port: typeof address === "object" && address ? address.port : 0,
      });
    });
  });
}

describe("pickPort", () => {
  it("uses ASSETS_PORT when it is set and free", async () => {
    const port = await freePort();
    await expect(pickPort({ ASSETS_PORT: String(port) })).resolves.toBe(port);
  });

  it("picks a free port when ASSETS_PORT is not set", async () => {
    const port = await pickPort({});
    expect(port).toBeGreaterThan(0);
    await expect(assertPortFree(port)).resolves.toBeUndefined();
  });

  it.each(["abc", "0", "70000", "3000.5", "-1"])(
    "rejects an invalid ASSETS_PORT %s",
    async (value) => {
      await expect(pickPort({ ASSETS_PORT: value })).rejects.toThrow(
        /ASSETS_PORT must be a port number/
      );
    }
  );

  it("fails clearly when ASSETS_PORT is taken", async () => {
    const { server, port } = await listen();
    try {
      await expect(pickPort({ ASSETS_PORT: String(port) })).rejects.toThrow(
        new RegExp(`port ${port} is already in use`)
      );
    } finally {
      server.close();
    }
  });
});

describe("nextDevArgs", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dev-server-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("starts plain next dev on the port when node_modules is a real dir", () => {
    mkdirSync(join(root, "node_modules"));
    expect(usesSymlinkedModules(root)).toBe(false);
    const args = nextDevArgs(root, 4123);
    expect(args.slice(-3)).toEqual(["dev", "-p", "4123"]);
    expect(args).not.toContain("--webpack");
  });

  it("adds --webpack when node_modules is a symlink (a worktree)", () => {
    const real = mkdtempSync(join(tmpdir(), "dev-server-real-"));
    try {
      symlinkSync(real, join(root, "node_modules"));
      expect(usesSymlinkedModules(root)).toBe(true);
      expect(nextDevArgs(root, 4123)).toContain("--webpack");
    } finally {
      rmSync(real, { recursive: true, force: true });
    }
  });

  it("is not a symlink when there is no node_modules", () => {
    expect(usesSymlinkedModules(root)).toBe(false);
  });
});

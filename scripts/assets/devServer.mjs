/**
 * Dev server helper for the asset scripts (checkin, measure).
 *
 * - The port comes from ASSETS_PORT, else a free one is picked. Nothing
 *   assumes a fixed port, so several checkouts can run side by side.
 * - A server is only reused when the caller names one (`--base` or
 *   ASSETS_BASE): an unnamed server on some port may serve another checkout.
 * - A checkout whose node_modules is a symlink (see scripts/assets/worktree.sh)
 *   starts Next with --webpack, because Turbopack refuses to follow it.
 * - Only the server this process spawned is ever stopped: it is killed by its
 *   own process group, never by name.
 */
import { spawn } from "node:child_process";
import { lstatSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

const SERVER_TIMEOUT_MS = 180_000;

/** True when node_modules is a symlink (a worktree sharing the main one). */
export function usesSymlinkedModules(root) {
  try {
    return lstatSync(join(root, "node_modules")).isSymbolicLink();
  } catch {
    return false;
  }
}

/** Resolves when nothing is listening on `port` (any address), else throws. */
export function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error) =>
      reject(
        new Error(
          error.code === "EADDRINUSE"
            ? `port ${port} is already in use: stop what is using it, or set ASSETS_PORT to a free port`
            : `cannot use port ${port}: ${error.message}`
        )
      )
    );
    // No host: binds every address, so a server on 0.0.0.0 or :: is seen too.
    probe.listen(port, () => probe.close(() => resolve()));
  });
}

/** A free TCP port, asked of the OS and then bind-checked like any other. */
export async function freePort() {
  const port = await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, () => {
      const { port: picked } = probe.address();
      probe.close(() => resolve(picked));
    });
  });
  await assertPortFree(port);
  return port;
}

/** ASSETS_PORT when set (valid and free), else a free port. */
export async function pickPort(env = process.env) {
  if (env.ASSETS_PORT) {
    const port = Number(env.ASSETS_PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(
        `ASSETS_PORT must be a port number, got "${env.ASSETS_PORT}"`
      );
    }
    await assertPortFree(port);
    return port;
  }
  return freePort();
}

/** The arguments `next` gets for a dev server (without the node binary). */
export function nextDevArgs(root, port) {
  const args = [
    join(root, "node_modules", "next", "dist", "bin", "next"),
    "dev",
    "-p",
    String(port),
  ];
  if (usesSymlinkedModules(root)) args.push("--webpack");
  return args;
}

async function answers(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns `{ url, stop }`. Reuses the server at `base` when given and it
 * answers; otherwise spawns `next dev` and `stop` ends exactly that one.
 */
export async function ensureDevServer(root, { base } = {}) {
  const named = base ?? process.env.ASSETS_BASE;
  if (named && (await answers(named))) return { url: named, stop: () => {} };
  const port = await pickPort();
  const url = `http://localhost:${port}`;
  const args = nextDevArgs(root, port);
  console.log(
    `starting next dev on ${port}${args.includes("--webpack") ? " (webpack: symlinked node_modules)" : ""}`
  );
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "ignore",
    detached: true,
  });
  const stop = () => {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  };
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      stop();
      process.exit(130);
    });
  }
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  let spawnError = null;
  child.once("error", (error) => {
    spawnError = error;
  });
  const deadline = Date.now() + SERVER_TIMEOUT_MS;
  for (;;) {
    // Check the child first: a server that answers on the port is only ours
    // while the process we spawned is still running.
    if (spawnError || exited()) {
      stop();
      throw new Error(
        `next dev exited before it was ready${spawnError ? `: ${spawnError.message}` : ""}`
      );
    }
    if (Date.now() > deadline) {
      stop();
      throw new Error("dev server did not start in time");
    }
    if (await answers(url)) {
      if (exited()) {
        throw new Error("next dev exited; something else answers on the port");
      }
      return { url, stop };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

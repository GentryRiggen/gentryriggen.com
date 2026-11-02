#!/usr/bin/env node
/**
 * Builds Jim's own Hosting site from the one static export, and fills in its
 * Content-Security-Policy.
 *
 *   node scripts/jim-site.mjs           # deploy: writes out-jim/ and firebase.json
 *   node scripts/jim-site.mjs --check   # build job: every check, writes nothing
 *     [--out out] [--dest out-jim] [--config firebase.json]
 *
 * out-jim/ gets only Jim's page and what it loads (JIM_FILES) plus a
 * script-free 404.html. Then out/ (the main site) loses Jim: its page,
 * payloads, manifest and icons go (MAIN_REMOVE), /jim/version.json stays so
 * an open old page sees a new build, and out/jim-sw.js becomes the kill
 * switch (public/jim-sw-kill.js) that retires the old worker. The main site
 * answers every /jim address with jim-moved.html (firebase.json), which
 * wipes Jim's data there and moves the visitor to the new address.
 *
 * The CSP in the "jim" hosting target carries a
 * placeholder that is replaced by one hash per inline script in jim.html,
 * so the inline scripts that run are exactly the ones this build made.
 *
 * Exits 1, naming the cause, when jim.html is missing, the placeholder is
 * gone, an inline script or handler would run without a hash, the page loads
 * App Check, reCAPTCHA or analytics, or (outside an e2e build) a shipped
 * chunk still has the e2e test hooks.
 */
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/** Committed in firebase.json; the deploy replaces it with the hashes. */
export const CSP_PLACEHOLDER = "'sha256-JIM-INLINE-SCRIPTS'";

/** Everything Jim's site serves, relative to the export (pinned). */
const JIM_EXACT = new Set([
  "jim.html",
  "jim/version.json",
  "jim-sw.js",
  "jim.webmanifest",
  "icon.svg",
]);
const JIM_DIRS = ["jim-icons/", "_next/"];

/** The main site's moved page and the worker that replaces Jim's there. */
const MOVED_FILES = ["jim-moved.html", "jim-moved.js", "jim-sw-kill.js"];
const KILL_SWITCH = "jim-sw-kill.js";

/** What the main site no longer serves once Jim has its own site. */
const MAIN_REMOVE = ["jim.html", "jim.txt", "jim.webmanifest", "jim-icons"];
/** Kept in out/jim/: the version file an open old page polls. */
const MAIN_KEEP_IN_JIM_DIR = new Set(["version.json"]);

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Not here</title>
</head>
<body>
<p>Not here. Jim lives at <a href="/jim">/jim</a>.</p>
</body>
</html>
`;

/** Script types the browser runs; anything else (JSON, JSON-LD) is data. */
const RUNNABLE_TYPES = new Set([
  "",
  "module",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
  "text/jscript",
  "text/livescript",
  "application/x-javascript",
  "application/x-ecmascript",
  "text/x-javascript",
  "text/x-ecmascript",
]);

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

function attr(attrs, name) {
  const m = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  ).exec(attrs);
  if (!m)
    return new RegExp(`(?:^|\\s)${name}(?:\\s|$)`, "i").test(attrs) ? "" : null;
  return m[1] ?? m[2] ?? m[3] ?? "";
}

/** The inline scripts the browser would run, as the text it hashes. */
function runnableInlineScripts(html) {
  const bodies = [];
  for (const [, attrs, body] of html.matchAll(SCRIPT_RE)) {
    if (attr(attrs, "src") !== null) continue;
    const type = (attr(attrs, "type") ?? "").trim().toLowerCase();
    if (!RUNNABLE_TYPES.has(type)) continue;
    // The HTML parser turns CR and CRLF into LF before the script runs.
    const text = body.replace(/\r\n?/g, "\n");
    if (text === "") continue;
    bodies.push(text);
  }
  return bodies;
}

function hashOf(text) {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

/** One CSP source per runnable inline script (no duplicates). */
export function inlineScriptHashes(html) {
  return [...new Set(runnableInlineScripts(html).map(hashOf))];
}

function jimTarget(firebaseJson) {
  const sites = Array.isArray(firebaseJson?.hosting)
    ? firebaseJson.hosting
    : [];
  const jim = sites.find((site) => site?.target === "jim");
  if (!jim) throw new Error('firebase.json has no "jim" hosting target');
  return jim;
}

/** A copy of firebase.json with the jim target's CSP placeholder filled in. */
export function applyCsp(firebaseJson, hashes) {
  const copy = JSON.parse(JSON.stringify(firebaseJson));
  let found = 0;
  for (const rule of jimTarget(copy).headers ?? []) {
    for (const header of rule.headers ?? []) {
      if (header.key.toLowerCase() !== "content-security-policy") continue;
      if (!header.value.includes(CSP_PLACEHOLDER)) continue;
      header.value = header.value
        .replace(CSP_PLACEHOLDER, hashes.join(" "))
        .replace(/ +;/g, ";")
        .replace(/ {2,}/g, " ");
      found += 1;
    }
  }
  if (found === 0) {
    throw new Error(
      `the CSP placeholder ${CSP_PLACEHOLDER} is missing from the jim target in firebase.json`
    );
  }
  return copy;
}

/** The export's files that belong on Jim's site (pinned list). */
export function jimFiles(paths) {
  return paths.filter(
    (p) => JIM_EXACT.has(p) || JIM_DIRS.some((dir) => p.startsWith(dir))
  );
}

/** The e2e stand-ins that must never ship. */
export function hasTestHooks(js) {
  return js.includes("__JIM_TEST__") || js.includes("e2e-token");
}

/** Third-party loaders and trackers Jim's page must not pull in. */
const FORBIDDEN = [
  // The loader and its global, not the shared config's inert site key field.
  ["reCAPTCHA", /recaptcha\/(?:enterprise|api)\.js|grecaptcha/i],
  ["App Check", /firebaseappcheck|x-firebase-appcheck/i],
  ["gstatic", /gstatic\.com/i],
  ["Google tag", /googletagmanager|google-analytics\.com/i],
  ["pageview analytics", /\/pageviews\//],
];

/** The names of anything forbidden this text references. */
export function forbiddenRefs(text) {
  return FORBIDDEN.filter(([, re]) => re.test(text)).map(([name]) => name);
}

/** The built scripts jim.html loads: script tags and the RSC payload's lists. */
export function pageChunks(html) {
  const found = new Set();
  for (const m of html.matchAll(/\/?(_next\/static\/[\w./~-]+?\.js)\b/g)) {
    found.add(m[1]);
  }
  return [...found];
}

/** Why the CSP would not cover this page's inline code, if it wouldn't. */
export function unhashedProblems(html, csp) {
  const problems = [];
  const opened = (html.match(/<script\b/gi) ?? []).length;
  const closed = [...html.matchAll(SCRIPT_RE)].length;
  if (opened !== closed) {
    problems.push(
      `${opened - closed} <script> tag(s) that could not be read, so not hashed`
    );
  }
  for (const text of runnableInlineScripts(html)) {
    if (!csp.includes(hashOf(text))) {
      problems.push(`an inline script is not hashed (${text.slice(0, 40)}…)`);
    }
  }
  const markup = html.replace(SCRIPT_RE, "<script></script>");
  for (const [tag] of markup.matchAll(/<[a-z][^>]*>/gi)) {
    if (/\son[a-z]+\s*=/i.test(tag)) {
      problems.push(
        `an inline event handler can't be hashed: ${tag.slice(0, 60)}`
      );
    }
    if (/=\s*["']?\s*javascript:/i.test(tag)) {
      problems.push(`a javascript: URL can't be hashed: ${tag.slice(0, 60)}`);
    }
  }
  return problems;
}

function listFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile())
        files.push(relative(root, full).split(sep).join("/"));
    }
  };
  walk(root);
  return files;
}

function jimCsp(firebaseJson) {
  for (const rule of jimTarget(firebaseJson).headers ?? []) {
    if (rule.source !== "**") continue;
    for (const header of rule.headers ?? []) {
      if (header.key.toLowerCase() === "content-security-policy")
        return header.value;
    }
  }
  throw new Error('the jim target has no Content-Security-Policy on "**"');
}

/**
 * Checks the export and (unless `check`) writes out-jim/ and the filled-in
 * firebase.json. Throws an Error naming the cause on any failure.
 *
 * @param {{ out?: string; dest?: string; config?: string; check?: boolean;
 *   env?: Record<string, string | undefined> }} [options]
 */
export function run({
  out = "out",
  dest = "out-jim",
  config = "firebase.json",
  check = false,
  env = process.env,
} = {}) {
  const page = join(out, "jim.html");
  if (!existsSync(page)) throw new Error(`${page} is missing: build first`);
  const html = readFileSync(page, "utf8");

  for (const file of MOVED_FILES) {
    if (!existsSync(join(out, file))) {
      throw new Error(`${join(out, file)} is missing: the main site needs it`);
    }
  }

  const files = jimFiles(listFiles(out));

  if (env.NEXT_PUBLIC_E2E !== "1") {
    const hooked = files.filter(
      (f) =>
        f.startsWith("_next/static/chunks/") &&
        f.endsWith(".js") &&
        hasTestHooks(readFileSync(join(out, f), "utf8"))
    );
    if (hooked.length) {
      throw new Error(`e2e test hooks in shipped chunks: ${hooked.join(", ")}`);
    }
  }

  for (const chunk of ["jim.html", ...pageChunks(html)]) {
    const path = join(out, chunk);
    if (!existsSync(path)) {
      throw new Error(`jim.html loads ${chunk}, which the build doesn't have`);
    }
    const refs = forbiddenRefs(readFileSync(path, "utf8"));
    if (refs.length) {
      throw new Error(
        `Jim's page loads ${refs.join(", ")} (in ${chunk}); it must not`
      );
    }
  }

  const firebaseJson = JSON.parse(readFileSync(config, "utf8"));
  const deployed = applyCsp(firebaseJson, inlineScriptHashes(html));
  const problems = unhashedProblems(html, jimCsp(deployed));
  if (problems.length) {
    throw new Error(
      `jim.html has inline code the CSP won't run: ${problems.join("; ")}`
    );
  }

  if (check) return { files, hashes: inlineScriptHashes(html) };

  rmSync(dest, { recursive: true, force: true });
  for (const file of files) {
    const target = join(dest, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(out, file), target);
  }
  writeFileSync(join(dest, "404.html"), NOT_FOUND_HTML);
  writeFileSync(config, `${JSON.stringify(deployed, null, 2)}\n`);
  retireJimFromMain(out);
  return { files, hashes: inlineScriptHashes(html) };
}

/**
 * Takes Jim off the main site's export. Runs after out-jim/ has its copy of
 * the real worker, so the kill switch never reaches Jim's own site.
 */
function retireJimFromMain(out) {
  cpSync(join(out, KILL_SWITCH), join(out, "jim-sw.js"));
  for (const name of MAIN_REMOVE) {
    rmSync(join(out, name), { recursive: true, force: true });
  }
  const jimDir = join(out, "jim");
  if (existsSync(jimDir)) {
    for (const entry of readdirSync(jimDir)) {
      if (!MAIN_KEEP_IN_JIM_DIR.has(entry)) {
        rmSync(join(jimDir, entry), { recursive: true, force: true });
      }
    }
  }
}

function parseArgs(argv) {
  const opts = { check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") opts.check = true;
    else if (["--out", "--dest", "--config"].includes(arg))
      opts[arg.slice(2)] = argv[++i];
    else throw new Error(`unknown argument ${arg}`);
  }
  return opts;
}

// Run only as a script (tests import the helpers).
if (process.argv[1] && /jim-site\.mjs$/.test(process.argv[1])) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const { files, hashes } = run(opts);
    console.log(
      `jim-site: ${opts.check ? "checked" : "wrote"} ${files.length} files, ${hashes.length} inline script hash(es)`
    );
  } catch (error) {
    console.error(`::error::jim-site: ${error.message}`);
    process.exit(1);
  }
}

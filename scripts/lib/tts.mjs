// Shared Google Cloud Text-to-Speech recording for the games' voice lines.
//
// `recordVoiceLines` calls the API only for lines whose text hash changed,
// writes the MP3s to public/<prefix>/<id>.mp3, rewrites the manifest and
// deletes clips whose line no longer exists. Nothing calls the API at runtime.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const PROJECT = "gentryriggen";
const WORDS_PER_SECOND = 2.3;

const hash = (text) =>
  createHash("sha1").update(text).digest("hex").slice(0, 12);

/**
 * Runs a TypeScript module through tsx and returns `expression` (evaluated
 * with the module as `m`), which must be the `{ id, text }[]` lines.
 */
export function loadLines(modulePath, expression) {
  const code = `import(${JSON.stringify(modulePath)}).then((m) => console.log(JSON.stringify(${expression})))`;
  const out = execFileSync("npx", ["--yes", "tsx", "-e", code], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out.trim().split("\n").pop());
}

function accessToken() {
  return execFileSync("gcloud", ["auth", "print-access-token"], {
    encoding: "utf8",
  }).trim();
}

async function synthesize(text, token, voice, speakingRate) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-goog-user-project": PROJECT,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "en-US", name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate },
    }),
  });
  if (!res.ok) {
    throw new Error(`TTS failed (${res.status}): ${await res.text()}`);
  }
  const { audioContent } = await res.json();
  return Buffer.from(audioContent, "base64");
}

function listClips(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listClips(join(dir, entry.name))
      : entry.name.endsWith(".mp3")
        ? [join(dir, entry.name)]
        : []
  );
}

/**
 * Records `lines` with `voice` into public/<prefix>/<id>.mp3 and keeps the
 * manifest (relative to the repo root) in step.
 */
export async function recordVoiceLines({
  lines,
  prefix,
  manifest,
  voice,
  speakingRate,
}) {
  const voiceDir = join(ROOT, "public", prefix);
  const manifestPath = join(ROOT, manifest);
  const old = JSON.parse(readFileSync(manifestPath, "utf8"));
  const next = {};
  let token = null;
  let made = 0;

  for (const { id, text } of lines) {
    const file = `/${prefix}/${id}.mp3`;
    const path = join(ROOT, "public", file);
    const h = hash(text);
    const durationGuess = Math.round(
      text.split(/\s+/).length / WORDS_PER_SECOND
    );
    if (old[id]?.hash === h && existsSync(path)) {
      next[id] = { file, hash: h, durationGuess };
      continue;
    }
    token ??= accessToken();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await synthesize(text, token, voice, speakingRate));
    next[id] = { file, hash: h, durationGuess };
    made += 1;
    console.log(`generated ${id}`);
  }

  const wanted = new Set(
    Object.values(next).map((c) => join(ROOT, "public", c.file))
  );
  let removed = 0;
  for (const clip of listClips(voiceDir)) {
    if (wanted.has(clip)) continue;
    rmSync(clip);
    removed += 1;
    console.log(`removed ${relative(ROOT, clip)}`);
  }
  if (existsSync(voiceDir)) {
    for (const dir of readdirSync(voiceDir, { withFileTypes: true })) {
      const path = join(voiceDir, dir.name);
      if (dir.isDirectory() && readdirSync(path).length === 0) rmdirSync(path);
    }
  }

  writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(
    `${lines.length} lines: ${made} generated, ${removed} removed, ${lines.length - made} unchanged`
  );
}

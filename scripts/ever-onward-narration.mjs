// Pre-renders Ever Onward's narration with Google Cloud Text-to-Speech.
//
// Run: npm run narration:ever-onward   (needs gcloud, signed in)
//
// Reads every narratable line (lib/ever-onward/narration/lines.ts), calls the
// API only for lines whose text hash changed, writes the MP3s to
// public/ever-onward/voice/<universe>/<id>.mp3, updates manifest.json and
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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VOICE_DIR = join(ROOT, "public/ever-onward/voice");
const MANIFEST = join(ROOT, "lib/ever-onward/narration/manifest.json");
const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const PROJECT = "gentryriggen";
const WORDS_PER_SECOND = 2.3;

const hash = (text) =>
  createHash("sha1").update(text).digest("hex").slice(0, 12);

function loadLines() {
  const code = `import("./lib/ever-onward/narration/lines.ts").then((m) => console.log(JSON.stringify(m.narrationLines())))`;
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

async function synthesize(text, token) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-goog-user-project": PROJECT,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "en-US", name: "en-US-Chirp3-HD-Aoede" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.95 },
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

const lines = loadLines();
const old = JSON.parse(readFileSync(MANIFEST, "utf8"));
const next = {};
let token = null;
let made = 0;

for (const { id, text } of lines) {
  const file = `/ever-onward/voice/${id}.mp3`;
  const path = join(ROOT, "public", file);
  const h = hash(text);
  const durationGuess = Math.round(text.split(/\s+/).length / WORDS_PER_SECOND);
  if (old[id]?.hash === h && existsSync(path)) {
    next[id] = { file, hash: h, durationGuess };
    continue;
  }
  token ??= accessToken();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, await synthesize(text, token));
  next[id] = { file, hash: h, durationGuess };
  made += 1;
  console.log(`generated ${id}`);
}

const wanted = new Set(
  Object.values(next).map((c) => join(ROOT, "public", c.file))
);
let removed = 0;
for (const clip of listClips(VOICE_DIR)) {
  if (wanted.has(clip)) continue;
  rmSync(clip);
  removed += 1;
  console.log(`removed ${relative(ROOT, clip)}`);
}
for (const dir of readdirSync(VOICE_DIR, { withFileTypes: true })) {
  const path = join(VOICE_DIR, dir.name);
  if (dir.isDirectory() && readdirSync(path).length === 0) rmdirSync(path);
}

writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  `${lines.length} lines: ${made} generated, ${removed} removed, ${lines.length - made} unchanged`
);

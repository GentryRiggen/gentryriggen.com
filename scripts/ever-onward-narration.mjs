// Pre-renders Ever Onward's narration with Google Cloud Text-to-Speech.
//
// Run: npm run narration:ever-onward   (needs gcloud, signed in)
//
// Reads every narratable line (lib/ever-onward/narration/lines.ts), calls the
// API only for lines whose text hash changed, writes the MP3s to
// public/ever-onward/voice/<universe>/<id>.mp3, updates manifest.json and
// deletes clips whose line no longer exists. Nothing calls the API at runtime.
import { loadLines, recordVoiceLines } from "./lib/tts.mjs";

await recordVoiceLines({
  lines: loadLines(
    "./lib/ever-onward/narration/lines.ts",
    "m.narrationLines()"
  ),
  prefix: "ever-onward/voice",
  manifest: "lib/ever-onward/narration/manifest.json",
  voice: "en-US-Chirp3-HD-Aoede",
  speakingRate: 0.95,
});

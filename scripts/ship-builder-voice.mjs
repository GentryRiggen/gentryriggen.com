// Pre-renders Ship Builder's escape voice lines with Google Cloud
// Text-to-Speech.
//
// Run: npm run voice:ship-builder   (needs gcloud, signed in)
//
// Reads every line (lib/ship-builder/voice/lines.ts), calls the API only for
// lines whose text hash changed, writes the MP3s to
// public/ship-builder/voice/<id>.mp3, updates manifest.json and deletes clips
// whose line no longer exists. Nothing calls the API at runtime.
import { loadLines, recordVoiceLines } from "./lib/tts.mjs";

await recordVoiceLines({
  lines: loadLines("./lib/ship-builder/voice/lines.ts", "m.SHIP_VOICE_LINES"),
  prefix: "ship-builder/voice",
  manifest: "lib/ship-builder/voice/manifest.json",
  voice: "en-US-Chirp3-HD-Puck",
  speakingRate: 1.0,
});

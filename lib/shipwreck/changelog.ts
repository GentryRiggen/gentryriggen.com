/**
 * What changed in each Shipwreck release, newest first. Shown on the Versions
 * page.
 *
 * Every bump of SHIPWRECK_VERSION needs a new entry at the top (a test
 * enforces it), in plain words a young player or their parent would follow.
 * 0.1.0 was a coming-soon page so the game could be pinned to a home screen;
 * 1.0.0 is the first playable release: until it ships, keep editing its entry.
 */
export interface Release {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG: readonly Release[] = [
  {
    version: "1.0.0",
    date: "2026-11-21",
    title: "The Titanic's last night",
    highlights: [
      "Watch the real night, from the iceberg at 11:40 PM to the end. Real physics works out every minute: the water pours in room by room, the bow goes down, the lights go out and the ship breaks in two, then sinks 3,800 m to the sea floor",
      "Try What if? Tap the parts of the hull to make holes and see whether she floats. Open just the front four and she stays afloat",
      "Fly around her: drag to look, pinch to zoom, double-tap the ship to fly close, or pick a camera (the bridge, the stern, a lifeboat, under the water or the movie camera)",
      "X-ray makes the hull see-through, so you can watch the water filling up inside each room",
      "Places to visit: pins fly you to the Bridge, the Grand Staircase, Boiler Room 6 and the Engine Room",
      "Play, pause and speed up the night (×1 to ×100). Drag the timeline or tap its icons to jump to the rockets, the first lifeboat, the break and the end",
      "A water panel shows how much sea is aboard and how far she tips; tap anything to learn what it means",
      "Sound: the calm sea, the engines' hum, roaring steam, rockets and the creaking hull. The sound button turns it all off at once",
      "Works offline once you have opened it",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-11-21",
    title: "Coming soon",
    highlights: [
      "Shipwreck has a home! Add it to your home screen now; the game itself is being built",
      "The first ship will be the Titanic, sinking the way a real ship sinks as the water comes in",
      "When the game is ready, a button will pop up here to load it",
    ],
  },
];

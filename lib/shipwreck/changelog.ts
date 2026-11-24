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
    version: "1.13.0",
    date: "2026-11-24",
    title: "Jump!",
    highlights: [
      "You can jump while you walk her decks. Tap the round jump button next to the stick, or press Space",
      "Run at the railing and jump to leap over the side! You fall all the way down to the sea with a big splash, then float and watch her go",
      "Just walking into the railing still keeps you safe on board, so you only go over when you jump",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-11-24",
    title: "Ride a lifeboat",
    highlights: [
      "Get in a lifeboat! While you walk her deck, stand next to a lifeboat and tap the yellow boat button. Your boat swings out, goes down the side and rows away, and you can look back and watch her sink from safely out on the water",
      "Not walking? Tap the boat button at the top to jump straight into the next boat to leave",
      "Your boat goes down as soon as you get in, even if the real one left later. The other boats still leave at their real times",
      "Drag to look around from the boat. Tap Back on deck to climb aboard her again",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-11-24",
    title: "The Poseidon",
    highlights: [
      "A seventh ship joins the game, and she is a made-up one: the Poseidon, a long white cruise ship with rows of balconies, orange lifeboats, a tall swept-back funnel and a ballroom under a big glass dome",
      "On New Year's Eve, in the middle of the Atlantic, a giant wave hits her side and rolls her right over, upside down. Watch her float on the air caught inside her, with her propellers up in the sky, until the water wins and she sinks, still upside down",
      "Try What if: there are seven spots where the water can get in, and a wave chip. Shut the spots and she may keep floating upside down. Pick the smaller wave and she can stand back up. Send it from straight ahead and she rides right over it",
      "Her paint box works too: her made-up colours, or fun ones",
      "She starts on a starry night, and the time button shows her by day. She has no sounds yet, and you can't walk her decks yet",
    ],
  },
  {
    version: "1.10.0",
    date: "2026-11-23",
    title: "Any time of day",
    highlights: [
      "A new sun-and-moon button at the top changes the time of day on every ship, even while she sinks: early morning, a sunny afternoon, sunset or a starry night. The anchor shows the time she really sank, and a new ship always starts at her real time",
      "The Edmund Fitzgerald keeps her storm, and can now be watched by daylight too",
      "Under the water is easier to see: the same button has lighter and brightest water to follow a ship down. Real water is still the start",
      "The torpedo's white trail now ends in a soft, frothy point instead of a square edge",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-11-23",
    title: "The Costa Concordia",
    highlights: [
      "A sixth ship joins the game: the Costa Concordia, a giant modern cruise ship. She is white with rows of balconies, orange lifeboats and a big yellow funnel with a blue C",
      "One January night in 2012 she sailed close past the island of Giglio in Italy and scraped rocks that tore a long hole in her side. Watch her lights go out, see her drift back to the island, lean over and come to rest on her side on the rocks right beside the harbour, half out of the water",
      "Her night: the island's hills, the little harbour town and the village on the hill with their lights, the moon rising, and her lifeboats motoring in to the harbour",
      "Try What if: tear fewer rooms and see her float, or let the wind blow her out to sea instead of back to the island",
      "Pick paint for her in the paint box too: her real colours, or fun cruise ship colours for her hull, funnel and lifeboats",
    ],
  },
  {
    version: "1.8.2",
    date: "2026-11-23",
    title: "The Carpathia shows again",
    highlights: [
      "Fixed the Carpathia's screen going black on many computers and iPads: a puff of smoke from a far-off convoy ship was breaking the picture",
    ],
  },
  {
    version: "1.8.1",
    date: "2026-11-23",
    title: "A lighter sea",
    highlights: [
      "The Carpathia's morning is a little easier on iPads: the far-off sea and the ships in her convoy take less work to draw",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-11-22",
    title: "Walk the Carpathia",
    highlights: [
      "Walk the Carpathia's decks! Stroll her bow, her boat deck, the covered walkway down each side and the open deck at her stern, and climb the ladders between them",
      "Her own sounds: the open sea far from land, two torpedo hits seconds apart, the third one later, and the groan as she goes down",
      "Six ships of her convoy steam along with her on the horizon, then turn and race away after the torpedoes hit",
      "Clouds in her sky and little white waves on her sea, like the one photo of her sinking",
      "Her lifeboats are their real size now, bigger than before",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-11-22",
    title: "A paint box for every ship",
    highlights: [
      "The paint brush now opens a paint box: tap a little ship to repaint her, even while she sinks. The box stays open so you can try one after another",
      "The top row (the anchor) is paint she really wore. The bottom row (the sparkles) is just for fun: colours other real ships of her day wore, like Cunard's red funnels, Blue Funnel's blue, a lavender hull or a royal yacht's white",
      "Every ship has a paint box now, the Titanic and the Edmund Fitzgerald too. The Fitzgerald tries other lake freighters' colours: black, grey, blue or green hulls",
    ],
  },
  {
    version: "1.6.1",
    date: "2026-11-22",
    title: "Carpathia fixes",
    highlights: [
      "The Carpathia's distress rockets look right in daylight now: a smoke trail and a puff of smoke, not night-time stars",
      "Every What if? on the Carpathia now comes to an end. If she stays afloat, you see it once she stops sinking, not hours later",
      "The words at the top now match the moment you jump to on the timeline",
      "The Go button in What if? fits on the screen again on iPads held sideways",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-11-22",
    title: "Walk the Britannic",
    highlights: [
      "Walk the Britannic's decks! Tap the walk button and stroll past her giant crane-like davits, her lifeboats and her funnels",
      "She has her own sounds now: a calm morning sea with gulls, the boom of the mine, her engines slowing as she stops, and two long blasts on her whistle at 9:00",
      "Her lifeboats now sit on the water near her, so you can see the boats that got everyone away",
      "On the sea floor her front mast lies bent beside her, just like on the real wreck",
      "The island of Kea is now drawn at its true height",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-11-22",
    title: "The Carpathia and a paint brush",
    highlights: [
      'A new ship! The Carpathia is the ship that rescued the Titanic\'s survivors in 1912. Six years later, in the First World War, she wore black, white and grey "dazzle" stripes to confuse submarines',
      "Watch her real morning, 17 July 1918, off Ireland: two torpedoes hit her side at 9:15, her boats row away, and a third torpedo comes at 10:50. She goes down bow first and lands upright on the sea floor, 150 m down",
      "What if? Tap where torpedoes hit her, one or more, and choose whether the last torpedo comes",
      "New paint brush button! Tap it while a ship sinks to switch her paint and back: the Carpathia's 1912 Cunard colours from the Titanic rescue, the Lusitania's red Cunard funnels from 1907, and the Britannic's black-hulled White Star colours, the ones she was built for but never wore",
      "Fly to her Wireless Room, where the Titanic's call for help was heard in 1912",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-11-22",
    title: "The Britannic",
    highlights: [
      "A new ship! The Britannic was the Titanic's little sister. In the First World War she was a hospital ship, painted white with a green stripe and big red crosses, with giant crane-like davits for her lifeboats",
      "Watch her real morning, 21 November 1916: a mine goes off at her bow near the Greek island of Kea, her captain turns for the shore, and water pours in through open portholes. Her bow hits the bottom while her back end is still in the air, then she rolls onto her side. She sank in 55 minutes",
      "What if? Shut her portholes, close her watertight doors, or don't run for Kea, and see if she stays afloat",
      "X-ray shows her holds and boiler rooms filling, and you can fly down to her wreck lying on its side",
    ],
  },
  {
    version: "1.3.2",
    date: "2026-11-22",
    title: "Faster walking, no sliding",
    highlights: [
      "Walking is much faster now, so you can run all over her deck",
      "No more sliding off: however much she tilts, the railings hold you on, so you can stay on her right to the end",
      "You only end up in the water when the sea comes up around you, and you paddle faster too",
    ],
  },
  {
    version: "1.3.1",
    date: "2026-11-22",
    title: "A shorter storm",
    highlights: [
      "The Edmund Fitzgerald's timeline now starts at 6:50 PM, about 20 minutes before she sinks, so you can scrub straight to the big waves and the end instead of hours of storm",
      "She takes a few seconds to get ready before it starts playing",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-11-22",
    title: "The Edmund Fitzgerald",
    highlights: [
      "A third ship! Pick the Edmund Fitzgerald on the title screen. She was a long ore carrier on Lake Superior, and on 10 November 1975 she sailed into a huge storm",
      "Watch the real storm, from her 3:30 PM report into the night: grey skies turning black, snow, spray and big waves washing over her deck. Just after 7:10 PM three giant waves come. The lake is not as deep as she was long, so her bow hits the bottom while her stern is still at the surface, and she breaks in two",
      "The big waves play at ×1 on the movie camera and her fall to the lake floor in slow motion, so you can see what happens",
      "Her storm has its own sounds: the wind rising, the swell, a hatch cover giving way and the big seas crashing over her",
      "What if? Choose which hatch covers leak, whether her vents are broken and whether she scrapes the shoal, then pick the real storm, a calmer one or a worse one. Keep her safe and she can make it to Whitefish Bay",
      "What if? now lets you pick more than one thing on every ship. The Lusitania can take several torpedoes, each with its own trail, a few seconds apart",
      "X-ray shows her long cargo holds full of iron ore pellets and her ballast tanks. New places to visit: the Pilothouse, the Ship's Bell, Cargo Hold 1, a Ballast Tank, the Engine Room and the Hatch Crane",
      "Walking the decks stays on the Titanic and the Lusitania",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-11-22",
    title: "Walk the decks",
    highlights: [
      "Walk on the deck of the Titanic or the Lusitania! Tap the walking button, then push the stick to walk and drag anywhere else to look around",
      "As she sinks, her deck tilts. A little tilt pushes you downhill, and when it gets too steep you slide, with arrows showing which way",
      "If the sea comes over the deck, or you slide off, you end up floating in the water. Paddle with the stick, or tap the ship button to get back on while you still can",
      "Look under: tap the eye button while floating to put your head under the water and watch her go down. Going into the water slows the time down (to ×1 if she is about to go under) so you can watch; speed it up again whenever you like",
      "Tap the bird button to fly the free camera again",
      "Splashes and the scrape of the deck under your feet, and no words needed: every walk button is a big picture",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-11-21",
    title: "Tidier ship buttons",
    highlights: [
      "The ship you pick on the title screen no longer has the top of its button cut off",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-11-21",
    title: "The Lusitania",
    highlights: [
      "A second ship! Pick the Lusitania on the title screen. On a sunny May afternoon in 1915, off the coast of Ireland, a torpedo hit her",
      "Watch her real afternoon: the torpedo's trail streaks in, it hits, a second explosion follows, and she leans fast to one side. Her bow hits the sea floor, only 93 m down, while her stern is still up in the air. She is gone in about 18 minutes and ends up lying on her side",
      "Her afternoon has its own look: a bright sky, a blue sea and the green Irish coast on the horizon, plus its own sounds",
      "X-ray shows her side coal bunkers, the long rooms along her sides that filled with water and made her lean",
      "What if? Choose where the torpedo hits, and whether her portholes (the round windows) are open or shut. Shut them at the real spot and see what happens",
      "New places to visit on her: the Bridge, the Dining Saloon, Boiler Room 1, a Coal Bunker and the Turbine Room",
      "Titanic fixes: the name on her stern reads properly again, and the free camera can no longer slip inside the ship or under the sea floor",
    ],
  },
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

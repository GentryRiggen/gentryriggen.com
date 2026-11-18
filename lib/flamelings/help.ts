import { FORM_LEVEL } from "./forms";
import { stageFor, STAGES, xpToNext } from "./progress";
import { tidiness } from "./status";
import type { Pet } from "./types";

/** The things on the pet screen a player can tap to learn about. */
export type HelpTopic = "fuel" | "joy" | "tidy" | "level" | "sparks";

/** One short line on a help card, with a picture in front of it. */
export interface HelpLine {
  glyph: string;
  text: string;
}

/** What a help card says. Short words: the players are young. */
export interface Help {
  title: string;
  /** How full this need is right now, 0 to 100 (needs only). */
  value?: number;
  /** One sentence on how things are right now. */
  now: string;
  lines: HelpLine[];
}

const LOW = 30;

function needNow(name: string, value: number, low: string, ok: string) {
  if (value < LOW) return low;
  if (value >= 80) return `${name} is ${ok}!`;
  return `${name} is doing fine.`;
}

/** The words on the card for `topic`, about this pet right now. */
export function helpFor(topic: HelpTopic, pet: Pet, sparkRounds: number): Help {
  const name = pet.name;
  switch (topic) {
    case "fuel":
      return {
        title: "Food",
        value: pet.fuel,
        now: needNow(
          name,
          pet.fuel,
          `${name} is hungry! Feed it soon.`,
          "nice and full"
        ),
        lines: [
          {
            glyph: "🔥",
            text: "This circle is food. It goes down slowly all day.",
          },
          { glyph: "🪵", text: "Tap Feed and pick a snack to fill it up." },
          {
            glyph: "🔸",
            text: "If it stays empty, your flameling fades into a sleepy ember.",
          },
        ],
      };
    case "joy":
      return {
        title: "Fun",
        value: pet.joy,
        now: needNow(
          name,
          pet.joy,
          `${name} is bored! Play with it.`,
          "super happy"
        ),
        lines: [
          { glyph: "❤️", text: "This circle is how happy your flameling is." },
          {
            glyph: "🦋",
            text: "Tap Play for a game. Snacks and happenings help too.",
          },
          {
            glyph: "💨",
            text: "A messy campfire makes it sad faster, so keep it tidy.",
          },
        ],
      };
    case "tidy": {
      const value = tidiness(pet);
      const puffs =
        pet.ash === 0
          ? "No ash right now. All clean!"
          : `${pet.ash} ash ${pet.ash === 1 ? "puff" : "puffs"} to clean up.`;
      return {
        title: "Tidy",
        value,
        now: value < LOW ? `It's messy! ${puffs}` : puffs,
        lines: [
          { glyph: "✨", text: "This circle is how clean the campfire is." },
          {
            glyph: "💨",
            text: "Ash puffs pop up every few hours. Tap a puff to blow it away.",
          },
          { glyph: "❤️", text: "Lots of ash makes your flameling sad faster." },
        ],
      };
    }
    case "level": {
      const stage = stageFor(pet.level);
      const next = STAGES.find((s) => s.from > pet.level);
      const left = Math.max(0, Math.ceil(xpToNext(pet.level) - pet.xp));
      const lines: HelpLine[] = [
        {
          glyph: "⭐",
          text: "Every time you care for your flameling, the ring fills up.",
        },
        {
          glyph: "🪵",
          text: "Feeding, playing, cleaning and petting all count.",
        },
        { glyph: "🎁", text: "Each new level can bring a present." },
      ];
      if (next) {
        lines.push({
          glyph: "🌱",
          text: `At level ${next.from} it grows into a ${next.name}.`,
        });
      }
      if (pet.level < FORM_LEVEL) {
        lines.push({
          glyph: "🌟",
          text: `At level ${FORM_LEVEL} it grows up into a Cozy, Wild or Sparkly flameling, from how you care for it.`,
        });
      }
      return {
        title: `Level ${pet.level}`,
        now: `${name} is a ${stage.name}. ${left} more to the next level.`,
        lines,
      };
    }
    case "sparks":
      return {
        title: "Sparks",
        now: `${name} has ${pet.sparks} ${pet.sparks === 1 ? "spark" : "sparks"}.`,
        lines: [
          {
            glyph: "🛍️",
            text: "Spend sparks in the Shop on hats, colours and decorations.",
          },
          {
            glyph: "🦋",
            text:
              sparkRounds > 0
                ? `Games give sparks: ${sparkRounds} more ${sparkRounds === 1 ? "game" : "games"} this time.`
                : "Games give sparks 3 times each morning and each evening. All used up for now, but playing still makes it happy!",
          },
          {
            glyph: "🎁",
            text: "Open the morning and evening presents for more.",
          },
          {
            glyph: "🍽️",
            text: "Feeding a hungry flameling and cleaning ash give a few too.",
          },
        ],
      };
  }
}

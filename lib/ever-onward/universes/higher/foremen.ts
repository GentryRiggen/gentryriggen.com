/**
 * The Town's foremen: six people, three hats. Each foreman changes what the
 * crew makes (a plus) and costs something somewhere else (a minus), and some
 * pairs get on while others clash, so the set of three is the choice. None of
 * it is luck, and the cards never say who is best: what is best moves with
 * the day, the height of the tower and the shadow.
 */
import { TUNING } from "./tuning";

const T = TUNING.town;

export interface Foreman {
  /** 1 to 6 (0 is an empty hat). */
  id: number;
  name: string;
  /** The hat colour, for the scene and the card. */
  hat: string;
  /** What the crew's pay is multiplied by, before the darkness term. */
  pay: number;
  /** ... plus this much for every bit of darkness (full dark = 1). */
  payDark: number;
  /** What taps pay. */
  tap: number;
  /** How much the tower leans. */
  lean: number;
  /** How hard the shadow bites (1 = as usual). */
  dark: number;
  /** Foremen this one gets on with, and clashes with. */
  likes: readonly number[];
  clashes: readonly number[];
  /** The plain-words story of the plus and the minus. */
  plus: string;
  minus: string;
}

export const FOREMEN: readonly Foreman[] = [
  {
    id: 1,
    name: "Speedy Sal",
    hat: "#e8554e",
    pay: 1.18,
    payDark: 0,
    tap: 1,
    lean: 2,
    dark: 1.3,
    likes: [3, 5],
    clashes: [2],
    plus: "+18% bricks",
    minus: "The tower leans twice as much and the shadow bites 30% harder",
  },
  {
    id: 2,
    name: "Careful Kim",
    hat: "#4aa3df",
    pay: 0.9,
    payDark: 0,
    tap: 1,
    lean: 0.4,
    dark: 1,
    likes: [4],
    clashes: [1],
    plus: "The tower leans 60% less",
    minus: "-10% bricks, she works slowly",
  },
  {
    id: 3,
    name: "Tappy Tess",
    hat: "#ff8fb1",
    pay: 0.92,
    payDark: 0,
    tap: 2,
    lean: 1,
    dark: 1,
    likes: [1],
    clashes: [5, 6],
    plus: "Your taps pay twice as much",
    minus: "-8% bricks from the crew",
  },
  {
    id: 4,
    name: "Lantern Lou",
    hat: "#ffd23f",
    pay: 0.92,
    payDark: 0,
    tap: 1,
    lean: 1,
    dark: 0.4,
    likes: [2, 6],
    clashes: [5],
    plus: "The shadow bites 60% less",
    minus: "-8% bricks, he keeps stopping to polish lamps",
  },
  {
    id: 5,
    name: "Night-owl Olly",
    hat: "#a77bd8",
    pay: 0.8,
    payDark: 0.6,
    tap: 1,
    lean: 1,
    dark: 1,
    likes: [1],
    clashes: [3, 4],
    plus: "Up to +40% bricks when the town is dark",
    minus: "-20% bricks when it is bright",
  },
  {
    id: 6,
    name: "Big Bertha",
    hat: "#6cc070",
    pay: 1.12,
    payDark: 0,
    tap: 0.4,
    lean: 1.5,
    dark: 1,
    likes: [4],
    clashes: [3],
    plus: "+12% bricks from the crew",
    minus: "Your taps pay 60% less and the tower leans 50% more",
  },
];

export const foreman = (id: number): Foreman | undefined =>
  FOREMEN.find((f) => f.id === id);

/** +12% or -12% for a pair that gets on or clashes. */
export function pairMult(a: Foreman, b: Foreman): number {
  if (a.likes.includes(b.id) || b.likes.includes(a.id)) return T.pairLike;
  if (a.clashes.includes(b.id) || b.clashes.includes(a.id)) return T.pairClash;
  return 1;
}

/** The foremen in a list of hat ids (empty hats and unknown ids dropped). */
const crew = (ids: readonly number[]): Foreman[] =>
  ids.flatMap((id) => {
    const f = foreman(id);
    return f ? [f] : [];
  });

/** What every pair in the crew does to the pay. */
export function pairsMult(ids: readonly number[]): number {
  const team = crew(ids);
  let mult = 1;
  for (let i = 0; i < team.length; i += 1)
    for (let j = i + 1; j < team.length; j += 1)
      mult *= pairMult(team[i], team[j]);
  return mult;
}

/** What the crew's pay is multiplied by with these foremen and this much darkness. */
export const crewPay = (ids: readonly number[], darkness: number): number =>
  crew(ids).reduce(
    (m, f) => m * (f.pay + f.payDark * darkness),
    // An empty hat is worn by the site's own regular foreman.
    T.regularPay ** (T.hats - crew(ids).length)
  ) * pairsMult(ids);

export const crewTap = (ids: readonly number[]): number =>
  crew(ids).reduce((m, f) => m * f.tap, 1) * pairsMult(ids);

export const crewLean = (ids: readonly number[]): number =>
  crew(ids).reduce((m, f) => m * f.lean, 1);

export const crewDark = (ids: readonly number[]): number =>
  crew(ids).reduce((m, f) => m * f.dark, 1);

/** Notes about who this foreman gets on with or clashes with, in plain words. */
export function pairNotes(f: Foreman): { likes: string; clashes: string } {
  const names = (ids: readonly number[]): string =>
    ids.map((id) => foreman(id)?.name ?? "").join(" and ");
  const pct = (n: number): string => `${Math.round(Math.abs(n - 1) * 100)}%`;
  return {
    likes: f.likes.length
      ? `Gets on with ${names(f.likes)}: +${pct(T.pairLike)} bricks together`
      : "",
    clashes: f.clashes.length
      ? `Clashes with ${names(f.clashes)}: -${pct(T.pairClash)} bricks together`
      : "",
  };
}

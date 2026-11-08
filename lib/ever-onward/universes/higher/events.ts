import type { EventSource } from "../../engine/types";
import { keepEvents, keepLine } from "./keepsakes";
import { overtimeSoFar } from "./knowhow";
import {
  lightsLine,
  lightsSoFar,
  swapLine,
  swapsSoFar,
  daysSoFar,
  dayNow,
} from "./town";
import { banksSoFar, playroomResultLine, tumblesSoFar } from "./playroom";
import {
  dropLine,
  dropsSoFar,
  ncFails,
  ncWins,
  noCraneFailLine,
  noCraneWinLine,
  snapLine,
  snapsSoFar,
  tieLine,
  tiesSoFar,
} from "./sky";

/** What goes in Build It Higher's running log. */
export const HIGHER_EVENTS: readonly EventSource[] = [
  {
    id: "overtime",
    count: overtimeSoFar,
    line: () => "Overtime! The whole crew is working extra hard for a while.",
  },
  {
    id: "playroom-tumble",
    count: tumblesSoFar,
    line: (run) => playroomResultLine(run) ?? "The top of the tower tumbled.",
  },
  {
    id: "town-foreman",
    count: swapsSoFar,
    line: swapLine,
  },
  {
    id: "town-lights",
    count: lightsSoFar,
    line: lightsLine,
  },
  {
    id: "town-day",
    count: daysSoFar,
    line: (run) => `${dayNow(run).name}. ${dayNow(run).note}`,
  },
  { id: "sky-drop", count: dropsSoFar, line: dropLine },
  { id: "sky-snap", count: snapsSoFar, line: snapLine },
  { id: "sky-tie", count: tiesSoFar, line: tieLine },
  { id: "sky-nocrane-win", count: ncWins, line: noCraneWinLine },
  { id: "sky-nocrane-fail", count: ncFails, line: noCraneFailLine },
  { id: "top-keepsake", count: keepEvents, line: keepLine },
  {
    id: "playroom-bank",
    count: banksSoFar,
    line: (run) => playroomResultLine(run) ?? "You banked a streak.",
  },
];

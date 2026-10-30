import { randomNickname } from "@/lib/leaderboard/nickname";
import { submitShipEntry } from "@/lib/leaderboard/shipBoard";
import { createBoardSync } from "@/lib/ship-builder/challenges/boardSync";
import { TEST_HOOKS_ENABLED } from "@/lib/ship-builder/testHooks";
import {
  challengeProgress,
  setChallengeNickname,
} from "@/lib/ship-builder/challenges/progressStore";

/**
 * Whether Ship Builder talks to the leaderboard at all. Off wherever test
 * hooks are on (unit tests, development and the e2e build), so none of them
 * make a network call; `NEXT_PUBLIC_LEADERBOARD=1` opts a dev build back in.
 */
export const SHIP_BOARD_ENABLED =
  !TEST_HOOKS_ENABLED || process.env.NEXT_PUBLIC_LEADERBOARD === "1";

const sync = createBoardSync({
  enabled: SHIP_BOARD_ENABLED,
  getProgress: challengeProgress.get,
  ensureNickname() {
    const existing = challengeProgress.get().nickname;
    if (existing !== null) return existing;
    const nickname = randomNickname();
    setChallengeNickname(nickname);
    return nickname;
  },
  submit: (entry) => submitShipEntry(entry),
});

/** Call after the stars change. */
export const requestShipBoardSubmit = sync.request;

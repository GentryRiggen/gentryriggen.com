import { trackGame } from "@/lib/analytics/trackGame";
import { trackTrialRun } from "../analytics";
import type { SimState } from "../sim/types";

jest.mock("@/lib/analytics/trackGame", () => ({ trackGame: jest.fn() }));

const sank = { outcome: "sank" } as SimState;

describe("trackTrialRun", () => {
  beforeEach(() => jest.mocked(trackGame).mockClear());

  it("records a storm trial in the wild sea", () => {
    trackTrialRun(sank, "wild", "storm");
    expect(trackGame).toHaveBeenCalledWith("trial_run", {
      kind: "storm",
      outcome: "sank",
      sea: "wild",
    });
  });

  it("records the other kinds by name", () => {
    trackTrialRun(sank, "calm", "iceberg");
    trackTrialRun({ outcome: null } as SimState, "stormy", "weather");
    expect(trackGame).toHaveBeenNthCalledWith(1, "trial_run", {
      kind: "iceberg",
      outcome: "sank",
      sea: "calm",
    });
    expect(trackGame).toHaveBeenNthCalledWith(2, "trial_run", {
      kind: "weather",
      outcome: "steady",
      sea: "stormy",
    });
  });
});

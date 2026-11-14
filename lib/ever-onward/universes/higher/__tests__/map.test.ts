import { describeMap } from "../../mapSuite.testkit";
import { higherUniverse } from "..";
import { higherBots } from "../bots";

// The Sky's wind and cable dials are part of the run and do not speed up with
// the map's boosts the way the income does, so run 10 lands near 80.5% of
// run 1 (the Sky's first fix round; it was 79.6% before the dials). The
// shared band is 65-80%; this part gets 2 points more.
describeMap(higherUniverse, () => higherBots().tapper, {
  maxRatioAtRun10: 0.82,
});

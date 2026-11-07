import { describeMap } from "../../mapSuite.testkit";
import { higherUniverse } from "..";
import { higherBots } from "../bots";

describeMap(higherUniverse, () => higherBots().tapper);

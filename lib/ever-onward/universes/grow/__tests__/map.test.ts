import { describeMap } from "../../mapSuite.testkit";
import { growUniverse } from "..";
import { growBots } from "../bots";

describeMap(growUniverse, () => growBots().tapper);

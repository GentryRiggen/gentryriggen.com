import { describeMap } from "../../mapSuite.testkit";
import { smileUniverse } from "..";
import { smileBots } from "../bots";

describeMap(smileUniverse, () => smileBots().tapper);

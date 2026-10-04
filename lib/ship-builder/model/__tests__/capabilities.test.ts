import { getPartDef } from "../catalog";
import { PART_TYPES } from "../types";

describe("part capabilities", () => {
  const typesWith = (flag: "propels" | "steers" | "holdsEdge") =>
    PART_TYPES.filter((type) => {
      const def = getPartDef(type);
      return def.placement === "attach" && def[flag] === true;
    });

  it("marks the parts that propel, steer and sit on a deck edge", () => {
    expect(typesWith("propels")).toEqual(["propeller", "azipod"]);
    expect(typesWith("steers")).toEqual(["rudder", "azipod"]);
    expect(typesWith("holdsEdge")).toEqual(["davit", "raft-canister"]);
  });
});

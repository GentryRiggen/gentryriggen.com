import { interiorFor } from "../../interior";
import { withInterior } from "../../interior/merge";
import { TITANIC_INTERIOR } from "../../interior/titanic";
import type { ShipId } from "../../ships/types";
import {
  BRITANNIC_WALK,
  CARPATHIA_WALK,
  LUSITANIA_WALK,
  TITANIC_WALK,
  walkMapFor,
} from "..";

describe("walk registry", () => {
  it("merges the Titanic's interior once", () => {
    const map = walkMapFor("titanic");
    expect(map).toEqual(withInterior(TITANIC_WALK, TITANIC_INTERIOR));
    expect(walkMapFor("titanic")).toBe(map);
  });

  it("leaves the other walkable ships' maps as they are", () => {
    expect(walkMapFor("lusitania")).toBe(LUSITANIA_WALK);
    expect(walkMapFor("britannic")).toBe(BRITANNIC_WALK);
    expect(walkMapFor("carpathia")).toBe(CARPATHIA_WALK);
  });

  it("has interiors for the Titanic only", () => {
    expect(interiorFor("titanic")).toBe(TITANIC_INTERIOR);
    for (const id of [
      "lusitania",
      "britannic",
      "carpathia",
      "concordia",
      "edmund-fitzgerald",
      "poseidon",
    ] as ShipId[])
      expect(interiorFor(id)).toBeNull();
  });
});

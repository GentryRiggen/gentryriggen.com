import type { PartType, PlacedPart, Rotation, Ship } from "./model/types";

export function gridPart(
  id: string,
  type: PartType,
  level: number,
  x: number,
  z: number,
  rotation: Rotation = 0
): PlacedPart {
  return { id, type, anchor: { kind: "grid", level, x, z }, rotation };
}

export function attachPart(
  id: string,
  type: PartType,
  parentId: string,
  pointId: string
): PlacedPart {
  return {
    id,
    type,
    anchor: { kind: "attach", parentId, pointId },
    rotation: 0,
  };
}

export function testShip(
  parts: PlacedPart[] = [],
  lengthSegments = 8,
  beam = 4
): Ship {
  return { v: 2, name: "Test", hull: { lengthSegments, beam }, parts };
}

const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

export function hasLoneSurrogate(text: string): boolean {
  return LONE_SURROGATE.test(text);
}

import type { ShipKind } from "../model/kinds";
import { cellKey, partCells } from "../model/grid";
import { emptyShip } from "../model/placement";
import type { PartType, PlacedPart, Rotation, Ship } from "../model/types";

/**
 * Builds a template ship one part at a time. Grid parts are remembered by
 * cell so attach parts can name the block they sit on. Add structure first
 * and attachments last: a block placed above an attach part is refused.
 */
export class ShipBuilder {
  private readonly ship: Ship;
  private readonly owners = new Map<string, string>();
  private count = 0;

  constructor(
    kind: ShipKind,
    name: string,
    lengthSegments: number,
    beam: number
  ) {
    this.ship = emptyShip(kind, name, lengthSegments, beam);
  }

  private nextId(): string {
    this.count += 1;
    return `p${this.count.toString(36)}`;
  }

  grid(
    type: PartType,
    level: number,
    x: number,
    z: number,
    rotation: Rotation = 0
  ): string {
    const part: PlacedPart = {
      id: this.nextId(),
      type,
      anchor: { kind: "grid", level, x, z },
      rotation,
    };
    this.ship.parts.push(part);
    for (const cell of partCells(part)) this.owners.set(cellKey(cell), part.id);
    return part.id;
  }

  attach(type: PartType, parentId: string, pointId: string): string {
    const id = this.nextId();
    this.ship.parts.push({
      id,
      type,
      anchor: { kind: "attach", parentId, pointId },
      rotation: 0,
    });
    return id;
  }

  /** Hull points (props, rudder, freefall boat) are parented to the hull. */
  hull(type: PartType, pointId: string): string {
    return this.attach(type, "hull", pointId);
  }

  /** The block occupying a cell; throws on a template mistake. */
  blockAt(level: number, x: number, z: number): string {
    const id = this.owners.get(cellKey({ level, x, z }));
    if (!id) throw new Error(`No block at level ${level}, x ${x}, z ${z}`);
    return id;
  }

  /** A part on the top of the block at (level, x, z), as a funnel would be. */
  onTop(type: PartType, level: number, x: number, z: number): string {
    return this.attach(type, this.blockAt(level, x, z), "funnel");
  }

  /** A mast-style part on the top of the block at (level, x, z). */
  onMast(type: PartType, level: number, x: number, z: number): string {
    return this.attach(type, this.blockAt(level, x, z), "mast");
  }

  /** A 2x2 part (large turret, helipad) whose lowest corner is (x, z). */
  onSquare(type: PartType, level: number, x: number, z: number): string {
    return this.attach(type, this.blockAt(level, x, z), `funnel-lg:${x}:${z}`);
  }

  /** A raft canister on a block's outer edge. */
  raft(level: number, x: number, z: number): string {
    return this.attach(
      "raft-canister",
      this.blockAt(level, x, z),
      `edge:${x}:${z}`
    );
  }

  /** A davit holding a boat; returns the boat's id. */
  boat(boat: PartType, level: number, x: number, z: number): string {
    const davit = this.attach(
      "davit",
      this.blockAt(level, x, z),
      `davit:${x}:${z}`
    );
    return this.attach(boat, davit, "boat");
  }

  /** 1x1 blocks over x in [x0, x1) on each listed row z. */
  cells(
    type: PartType,
    level: number,
    x0: number,
    x1: number,
    rows: readonly number[]
  ): void {
    for (const z of rows) {
      for (let x = x0; x < x1; x++) this.grid(type, level, x, z);
    }
  }

  /** Deck blocks over x in [x0, x1) on each row: 2x1 where they fit. */
  decks(level: number, x0: number, x1: number, rows: readonly number[]): void {
    for (const z of rows) {
      let x = x0;
      for (; x + 1 < x1; x += 2) this.grid("deck-2x1", level, x, z);
      if (x < x1) this.grid("deck-1x1", level, x, z);
    }
  }

  /** Overrides the hull's paint; unspecified areas keep the kind default. */
  withPaint(paint: NonNullable<Ship["hull"]["paint"]>): void {
    this.ship.hull.paint = { ...this.ship.hull.paint, ...paint };
  }

  /** A fresh copy, so callers can't alter the builder's ship. */
  build(): Ship {
    return {
      ...this.ship,
      hull: { ...this.ship.hull, paint: { ...this.ship.hull.paint } },
      parts: this.ship.parts.map((part) => ({ ...part })),
    };
  }
}

/** Integers from start (inclusive) to end (exclusive). */
export function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i);
}

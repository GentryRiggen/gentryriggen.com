import { act } from "react";
import {
  createInitialState,
  HISTORY_LIMIT,
  useShipBuilderStore,
} from "../store";
import type { GridAnchor } from "../../model/types";
import {
  attachPart,
  gridPart,
  hasLoneSurrogate,
  testShip,
} from "../../testing";

const store = () => useShipBuilderStore.getState();
const cell = (level: number, x: number, z: number): GridAnchor => ({
  kind: "grid",
  level,
  x,
  z,
});

beforeEach(() => {
  act(() => useShipBuilderStore.setState(createInitialState()));
});

describe("tools", () => {
  it("selects a tool and toggles it off when chosen again", () => {
    store().selectTool("deck-1x1");
    expect(store().tool).toEqual({
      kind: "place",
      type: "deck-1x1",
      rotation: 0,
    });
    store().selectTool("deck-1x1");
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("rotates grid tools only", () => {
    store().selectTool("deck-2x1");
    store().rotate();
    store().rotate();
    expect(store().tool).toMatchObject({ rotation: 180 });
    store().selectTool("funnel");
    store().rotate();
    expect(store().tool).toMatchObject({ rotation: 0 });
  });

  it("previews hover validity", () => {
    store().selectTool("deck-1x1");
    store().hoverAt(cell(1, 0, 0));
    expect(store().hover?.result).toEqual({
      ok: false,
      reason: "Needs a deck beneath every cell",
    });
    store().hoverAt(null);
    expect(store().hover).toBeNull();
  });

  it("cancel clears tool, hover and selection", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("a", "deck-1x1", 0, 2, 1)]),
      })
    );
    store().selectTool("deck-1x1");
    store().select("a");
    store().hoverAt(cell(0, 0, 0));
    store().cancel();
    expect(store().tool).toEqual({ kind: "none" });
    expect(store().hover).toBeNull();
    expect(store().selectedId).toBeNull();
  });

  it("forces attach parts to rotation 0", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("a", "deck-1x1", 0, 4, 1)]),
      })
    );
    store().selectTool("deck-2x1");
    store().rotate();
    store().selectTool("funnel");
    expect(
      store().placeAt({ kind: "attach", parentId: "a", pointId: "funnel" })
    ).toEqual({ ok: true });
    const funnel = store().ship.parts.find((p) => p.type === "funnel");
    expect(funnel?.rotation).toBe(0);
  });
});

describe("placement and history", () => {
  it("places with the active tool and keeps the tool selected", () => {
    store().selectTool("deck-2x1");
    store().rotate();
    expect(store().placeAt(cell(0, 0, 0))).toEqual({ ok: true });
    const [part] = store().ship.parts;
    expect(part).toMatchObject({ type: "deck-2x1", rotation: 90 });
    expect(store().tool.kind).toBe("place");
    expect(store().past).toHaveLength(1);
  });

  it("returns the reason and does not commit invalid placements", () => {
    store().selectTool("deck-1x1");
    expect(store().placeAt(cell(2, 0, 0)).ok).toBe(false);
    expect(store().ship.parts).toHaveLength(0);
    expect(store().past).toHaveLength(0);
  });

  it("requires a tool", () => {
    expect(store().placeAt(cell(0, 0, 0))).toEqual({
      ok: false,
      reason: "Pick a part first",
    });
  });

  it("undoes and redoes, keeping the current name", () => {
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().rename("Olympic");
    store().undo();
    expect(store().ship.parts).toHaveLength(0);
    expect(store().ship.name).toBe("Olympic");
    store().redo();
    expect(store().ship.parts).toHaveLength(1);
  });

  it("clears redo on a new commit", () => {
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().undo();
    store().placeAt(cell(0, 1, 0));
    expect(store().future).toHaveLength(0);
  });

  it("caps history", () => {
    // Hull resizes on an empty ship always commit.
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      store().changeHullLength(i % 2 === 0 ? 1 : -1);
    }
    expect(store().past).toHaveLength(HISTORY_LIMIT);
  });
});

describe("removal", () => {
  beforeEach(() => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "deck-1x1", 0, 2, 1),
          gridPart("b", "deck-1x1", 1, 2, 1),
        ]),
      })
    );
  });

  it("removes a leaf immediately", () => {
    store().select("b");
    store().requestDelete();
    expect(store().ship.parts.map((p) => p.id)).toEqual(["a"]);
    expect(store().selectedId).toBeNull();
  });

  it("asks before a cascade and removes on confirm", () => {
    store().select("a");
    store().requestDelete();
    expect(store().pendingRemoval).toEqual({ kind: "part", ids: ["a", "b"] });
    expect(store().ship.parts).toHaveLength(2);
    store().confirmRemoval();
    expect(store().ship.parts).toHaveLength(0);
    expect(store().pendingRemoval).toBeNull();
  });

  it("clears a pending cascade when a placement commits", () => {
    store().selectTool("deck-1x1");
    store().select("a");
    store().requestDelete();
    expect(store().pendingRemoval).not.toBeNull();
    expect(store().placeAt(cell(0, 5, 1))).toEqual({ ok: true });
    expect(store().pendingRemoval).toBeNull();
  });

  it("ignores a delete request for an unknown part", () => {
    act(() => useShipBuilderStore.setState({ selectedId: "ghost" }));
    store().requestDelete();
    expect(store().pendingRemoval).toBeNull();
    expect(store().selectedId).toBeNull();
    expect(store().past).toHaveLength(0);
  });

  it("undo and redo clear a pending removal", () => {
    store().changeHullLength(+1); // gives undo something to step back over
    store().select("a");
    store().requestDelete();
    store().undo();
    expect(store().pendingRemoval).toBeNull();
    store().select("a");
    store().requestDelete();
    store().redo();
    expect(store().pendingRemoval).toBeNull();
  });

  it("cancels a pending removal", () => {
    store().select("a");
    store().requestDelete();
    store().cancelRemoval();
    expect(store().pendingRemoval).toBeNull();
    expect(store().ship.parts).toHaveLength(2);
  });
});

describe("hull length", () => {
  it("grows immediately and clamps to range", () => {
    store().changeHullLength(+1);
    expect(store().ship.hull.lengthSegments).toBe(9);
    for (let i = 0; i < 20; i++) store().changeHullLength(+1);
    expect(store().ship.hull.lengthSegments).toBe(20);
  });

  it("shrinks immediately when nothing is lost", () => {
    store().changeHullLength(-1);
    expect(store().ship.hull.lengthSegments).toBe(7);
  });

  it("asks before shrinking past parts", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("aft", "deck-1x1", 0, 23, 0)]),
      })
    );
    store().changeHullLength(-1);
    expect(store().pendingRemoval).toEqual({
      kind: "hull",
      lengthSegments: 7,
      beam: 4,
      ids: ["aft"],
    });
    store().confirmRemoval();
    expect(store().ship.hull.lengthSegments).toBe(7);
    expect(store().ship.parts).toHaveLength(0);
  });

  it("clears a pending shrink when a placement commits", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("aft", "deck-1x1", 0, 23, 0)]),
      })
    );
    store().selectTool("deck-1x1");
    store().changeHullLength(-1);
    expect(store().pendingRemoval).not.toBeNull();
    expect(store().placeAt(cell(0, 22, 0))).toEqual({ ok: true });
    expect(store().pendingRemoval).toBeNull();
    store().confirmRemoval();
    expect(store().ship.hull.lengthSegments).toBe(8);
    expect(store().ship.parts).toHaveLength(2);
  });

  it("clears hover when the hull length changes", () => {
    store().selectTool("deck-1x1");
    store().hoverAt(cell(0, 0, 0));
    expect(store().hover).not.toBeNull();
    store().changeHullLength(+1);
    expect(store().hover).toBeNull();
  });
});

describe("beam", () => {
  it("widens and narrows immediately when nothing is lost, within 3-7", () => {
    store().changeBeam(+1);
    expect(store().ship.hull).toEqual({ lengthSegments: 8, beam: 5 });
    for (let i = 0; i < 10; i++) store().changeBeam(+1);
    expect(store().ship.hull.beam).toBe(7);
    for (let i = 0; i < 10; i++) store().changeBeam(-1);
    expect(store().ship.hull.beam).toBe(3);
    expect(store().past).toHaveLength(3 + 4);
  });

  it("asks before narrowing past parts, then applies both sizes", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([gridPart("port", "deck-1x1", 0, 5, 3)], 6),
      })
    );
    store().changeBeam(-1);
    expect(store().ship.hull.beam).toBe(4);
    expect(store().pendingRemoval).toEqual({
      kind: "hull",
      lengthSegments: 6,
      beam: 3,
      ids: ["port"],
    });
    store().confirmRemoval();
    expect(store().ship.hull).toEqual({ lengthSegments: 6, beam: 3 });
    expect(store().ship.parts).toHaveLength(0);
    store().undo();
    expect(store().ship.hull.beam).toBe(4);
    expect(store().ship.parts).toHaveLength(1);
  });

  it("asks before widening strands a davit inside the hull", () => {
    act(() =>
      useShipBuilderStore.setState({
        ship: testShip([
          gridPart("a", "deck-1x1", 0, 2, 3),
          gridPart("b", "deck-1x1", 1, 2, 3),
          attachPart("dv", "davit", "b", "davit:2:3"),
        ]),
      })
    );
    store().changeBeam(+1);
    expect(store().pendingRemoval).toEqual({
      kind: "hull",
      lengthSegments: 8,
      beam: 5,
      ids: ["dv"],
    });
    store().cancelRemoval();
    expect(store().ship.hull.beam).toBe(4);
  });

  it("keeps the beam when the hull length changes", () => {
    store().changeBeam(+1);
    store().changeHullLength(-1);
    expect(store().ship.hull).toEqual({ lengthSegments: 7, beam: 5 });
  });
});

describe("load, new, save, camera", () => {
  it("loadShip keeps an undo step and resets tools", () => {
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().loadShip(testShip([], 5), "ship-9");
    expect(store().ship.hull.lengthSegments).toBe(5);
    expect(store().savedId).toBe("ship-9");
    expect(store().past).toHaveLength(2);
    expect(store().future).toHaveLength(0);
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("loadShip with resetHistory starts a clean history", () => {
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().loadShip(testShip([], 5), "ship-9", { resetHistory: true });
    expect(store().past).toHaveLength(0);
    expect(store().future).toHaveLength(0);
    expect(store().tool).toEqual({ kind: "none" });
  });

  it("undoing a load restores the previous ship and savedId", () => {
    store().markSaved("ship-1");
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().loadShip(testShip([], 5), "ship-9");
    store().undo();
    expect(store().ship.parts).toHaveLength(1);
    expect(store().savedId).toBe("ship-1");
    store().redo();
    expect(store().ship.hull.lengthSegments).toBe(5);
    expect(store().savedId).toBe("ship-9");
  });

  it("newShip is undoable and clears savedId", () => {
    store().markSaved("ship-1");
    store().selectTool("deck-1x1");
    store().placeAt(cell(0, 0, 0));
    store().newShip();
    expect(store().ship.parts).toHaveLength(0);
    expect(store().savedId).toBeNull();
    store().undo();
    expect(store().ship.parts).toHaveLength(1);
    expect(store().savedId).toBe("ship-1");
  });

  it("truncates long names", () => {
    store().rename("x".repeat(80));
    expect(store().ship.name).toHaveLength(60);
  });

  it("truncates without splitting an emoji", () => {
    store().rename("a".repeat(59) + "😀");
    expect(hasLoneSurrogate(store().ship.name)).toBe(false);
  });

  it("bumps the camera nonce on every preset", () => {
    store().setCameraView("side");
    store().setCameraView("side");
    expect(store().camera).toEqual({ view: "side", nonce: 2 });
  });

  it("gives every notice a fresh id, even with the same text", () => {
    store().setNotice("Saved");
    const first = store().notice;
    store().setNotice("Saved");
    const second = store().notice;
    expect(first?.text).toBe("Saved");
    expect(second?.text).toBe("Saved");
    expect(second?.id).not.toBe(first?.id);
    store().setNotice(null);
    expect(store().notice).toBeNull();
  });

  it("keeps the notice across loadShip", () => {
    store().setNotice("Couldn't load that ship");
    store().loadShip(testShip(), null);
    expect(store().notice?.text).toBe("Couldn't load that ship");
  });
});

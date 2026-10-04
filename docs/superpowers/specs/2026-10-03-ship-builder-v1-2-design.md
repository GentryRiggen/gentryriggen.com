# Ship Builder v1.2 — Design

**Date:** 2026-10-03
**Status:** Approved
**Builds on:** `2026-10-04-ship-builder-v1-1-design.md` (shipped)

## Summary

1. Hulls up to 20 segments (was 12).
2. Large lifeboat that hangs between two adjacent davits.
3. Large funnel that sits on a 2×2 square of deck-block tops.
4. A "Below" camera view under the water, and propellers that factor into
   top speed.
5. Icons for every part, action, stat and warning so a non-reader can play.

## Non-goals

- Propeller sizes/variants, animated propellers.
- A 2×2 deck block.
- A save-format version bump (v2 stays; only new part types are added).

## 1. Longer hulls

- `MAX_SEGMENTS = 20`. Schema, store, toolbar and `validateShip` already use
  the constant.
- Camera framing must still fit under `MAX_VIEW_DISTANCE` at 60 cells; the
  camera tests' length list already includes `MAX_SEGMENTS`.

## 2. Attach-point claims (shared mechanism)

Today an attach point is taken when another part's anchor names the same
`parentId` + `pointId`. Large parts span several parents, so points gain
**claims**: string keys for the resources they occupy.

- `AttachPoint.claims?: string[]` (defaults to `[`${parentId}:${pointId}`]`).
- A point is taken when any of its claims is claimed by a placed attach part.
- Small funnel on a deck block claims `top:<level>:<x>:<z>` for every cell of
  the block. Large funnel claims the 4 cells of its square.
- A boat on a davit claims `davit:<davitId>`. A large boat claims both
  davits.
- `isPointTaken` / `openAttachPoints` / `canPlace` use claims. Existing
  saves resolve exactly as before.

## 3. Large lifeboat

- Part `lifeboat-large`: category lifeboats, "Large lifeboat", "90 seats ·
  hangs between two davits", seats 90, mass 0.4, height 0.5.
- Attach type `big-boat-mount`. A davit exposes point `big-boat` when another
  davit sits at the same level and side at `x + 1` (davit-point
  `davit:<x+1>:<z>` on any parent, same outward face). Position: midpoint of
  the two davits' boat positions.
- Anchor: `{ parentId: <forward davit id>, pointId: "big-boat" }`. The point
  disappears when the aft davit is removed, so the existing cascade drops the
  boat.
- emptyHint: "Put two davits side by side on the same deck edge".
- Mesh: a longer, wider boat than the standard one.

## 4. Large funnel

- Part `funnel-large`: category funnels, "Large funnel", "Sits on a 2×2 of
  deck tops · 75 stokers", stokers 75, mass 4, height 4.2.
- Attach type `large-funnel-mount`. For every 2×2 square of cells at the same
  level where every cell is the top of a **deck** block (role `deck`, nothing
  above it), the part occupying the square's lowest-x, lowest-z cell exposes
  point `funnel-lg:<x>:<z>`, positioned at the square's centre top.
- Claims the 4 `top:` keys, so small and large funnels can't overlap.
- Covering or removing any block under it removes the point → cascade.
- emptyHint: "Make a 2×2 of deck blocks with nothing on top".
- Mesh: a wider, taller funnel (≈1.7× radius, 1.3× height).

## 5. Below view and propellers

### Camera

- `CameraView` gains `"below"`. Its preset puts the camera under the water
  looking up at the hull from the stern quarter.
- While `below` is active, the orbit polar clamp allows angles past the
  horizon (up to ≈ π − 0.1) and the pan bounds allow negative target height.
  Choosing another preset restores the normal clamp.
- Ocean: double-sided; when viewed from below it is more transparent so the
  hull reads clearly. The hull draws its underwater body and keel.

### Propellers

- Category `propulsion` ("Propulsion"), part `propeller`: "Propeller",
  "Mounts under the stern · pushes the ship", mass 0.3, height 0.5.
- Attach type `prop-mount`. Hull points `prop:<i>` at the stern below the
  waterline, spread evenly across the beam. Count: beam 3 → 2, beam 4 → 3,
  beam ≥ 5 → 4.
- emptyHint: "Every propeller spot is taken".

### Speed

- Power: small funnel 1, large funnel 2.
- Each propeller uses up to `POWER_PER_PROP = 2`.
- `usable = min(power, props × 2)`.
- `speed = base + usable × perPower + segments × perSegment − tonnage loss`,
  clamped `[min, max]`; 0 when there are no funnels or no propellers.
- Constants are tuned so a Titanic-like ship (20 segments, 3 large funnels,
  3 propellers, typical superstructure) lands near 21 kn.
- Warnings:
  - `no-propellers`: "No propellers — she can't move" (when there are
    funnels but no props).
  - `needs-propellers`: "Not enough propellers for your funnels" (power >
    props × 2, props > 0).

## 6. Icons

- `PartIcon` (`components/ship-builder/ui/icons/PartIcon.tsx`): an inline
  SVG per `PartType`, drawn to look like the 3D part, `currentColor` + palette
  fills that work in light and dark mode, `aria-hidden`.
- Catalog: icon (≈40px) left of name/description, larger tap targets.
  Placement hint shows the selected part's icon.
- `lucide-react` (new dependency) for every toolbar action (length −/+, beam
  −/+, undo, redo, delete, camera presets incl. Below, new, my ships, save,
  share), dialogs' buttons, each stat row, and each warning code
  (`Record<WarningCode, LucideIcon>`). Text labels stay.

## Testing

- Model unit tests: claims (funnel overlap, small boat vs large boat), large
  boat point appears/disappears with the neighbour davit, 2×2 detection incl.
  mixed 1×1/2×1, cascade on removal, prop points by beam, speed calibration
  and warnings, 20-segment bound.
- Component tests: catalog renders an icon per part, warnings render icons,
  toolbar Below button.
- E2E: one path that places a large funnel, a large boat, and a propeller in
  the Below view.

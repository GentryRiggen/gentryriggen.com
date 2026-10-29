import { BufferGeometry, Matrix4, TorusGeometry } from "three";
import {
  buildBridgeWings,
  buildWindowGeometries,
} from "@/components/ship-builder/scene/blockDetailGeometry";
import type { KitName } from "@/components/ship-builder/scene/kitFiles";

/** A porthole's rim as the hull draws it without the kit: a torus. */
const PORTHOLE_RADIUS = 0.1;
const PORTHOLE_RIM_TUBE = 0.02;
const PORTHOLE_OFFSET = 0.012;

/**
 * The procedural stand-in for a kit piece, in the piece's own frame (face on
 * x = 0, outward +X, centred on the opening): the boxes and torus the game
 * draws until the kit's file loads. Built from the game's own geometry code,
 * so the studio's "old" build is what the game falls back to.
 */
export function kitStandIn(name: KitName): BufferGeometry {
  switch (name) {
    case "kit-window": {
      const { frames } = buildWindowGeometries({ x: 1, z: 1 }, [
        { face: "x+", y: 0, height: 0.22, width: 0.2, perCell: 1 },
      ]);
      return frames!.translate(-0.48, 0, 0);
    }
    case "kit-windscreen": {
      // One 0.4 unit of the band: a block just wide enough for it.
      const { frames } = buildWindowGeometries({ x: 1, z: 0.646 }, [
        { face: "x+", y: 0, height: 0.26, band: true },
      ]);
      return frames!.translate(-0.48, 0, 0);
    }
    case "kit-bridge-wing": {
      // The starboard wing only, its inner edge on the origin.
      const wings = buildBridgeWings({ x: 1 / 0.6, z: 1.5 }, 0.1, {
        bow: false,
        stern: false,
        starboard: false,
        port: true,
        top: false,
      });
      return wings!.translate(0, 0, -(1.5 * 0.48 - 0.16));
    }
    case "kit-porthole": {
      const torus = new TorusGeometry(
        PORTHOLE_RADIUS + PORTHOLE_RIM_TUBE / 2,
        PORTHOLE_RIM_TUBE,
        4,
        14
      );
      // Circles face +Z; this piece faces +X.
      return torus
        .applyMatrix4(new Matrix4().makeRotationY(Math.PI / 2))
        .translate(PORTHOLE_OFFSET, 0, 0);
    }
  }
}

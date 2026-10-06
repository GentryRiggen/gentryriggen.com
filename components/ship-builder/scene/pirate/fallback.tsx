"use client";

import Surface from "../Surface";
import { WOOD, type PirateDecorProps, type PirateMeshProps } from "./shared";

/** A small wooden crate: stands in until a group draws its own mesh. */
export function CrateMesh({ painted, tint, emphasis }: PirateMeshProps) {
  return (
    <mesh position={[0, 0.2, 0]} castShadow>
      <boxGeometry args={[0.4, 0.4, 0.4]} />
      <Surface
        color={painted ?? WOOD.oak}
        finish="wood"
        tint={tint}
        emphasis={emphasis}
      />
    </mesh>
  );
}

export function CrateDecor({ color, tint, emphasis }: PirateDecorProps) {
  return <CrateMesh painted={color} tint={tint} emphasis={emphasis} />;
}

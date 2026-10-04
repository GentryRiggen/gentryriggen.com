import { Color, Vector3 } from "three";
import type {
  ColorKey,
  Environment,
  NumberKey,
  VectorKey,
} from "./environmentModel";

/**
 * An `Environment` in the shape the renderer wants, built once and then
 * mutated every frame as it eases toward a new target: no per-frame
 * allocation.
 */
export interface RuntimeEnvironment {
  colors: Record<ColorKey, Color>;
  numbers: Record<NumberKey, number>;
  vectors: Record<VectorKey, Vector3>;
}

function mapValues<V, R>(
  source: Record<string, V>,
  convert: (value: V) => R
): Record<string, R> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, convert(value)])
  );
}

export function toRuntimeEnvironment(env: Environment): RuntimeEnvironment {
  return {
    colors: mapValues(env.colors, (hex) => new Color(hex)) as Record<
      ColorKey,
      Color
    >,
    numbers: { ...env.numbers },
    vectors: mapValues(
      env.vectors,
      ([x, y, z]) => new Vector3(x, y, z)
    ) as Record<VectorKey, Vector3>,
  };
}

/** Rate at which the scene eases into a newly chosen time or sea state. */
export const TRANSITION_RATE = 4;

/** Moves `current` the given share (0..1) of the way to `target`. */
export function easeEnvironment(
  current: RuntimeEnvironment,
  target: RuntimeEnvironment,
  amount: number
): void {
  let key: keyof RuntimeEnvironment["colors"];
  for (key in current.colors) {
    current.colors[key].lerp(target.colors[key], amount);
  }
  let numberKey: keyof RuntimeEnvironment["numbers"];
  for (numberKey in current.numbers) {
    current.numbers[numberKey] +=
      (target.numbers[numberKey] - current.numbers[numberKey]) * amount;
  }
  let vectorKey: keyof RuntimeEnvironment["vectors"];
  for (vectorKey in current.vectors) {
    current.vectors[vectorKey].lerp(target.vectors[vectorKey], amount);
  }
}

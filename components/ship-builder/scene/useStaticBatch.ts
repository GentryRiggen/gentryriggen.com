import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { Group } from "three";
import PartBatcher from "./PartBatcher";

/**
 * Merges the ship's static parts under `root` into a few draw calls (see
 * PartBatcher.ts). `ship` is whatever changes the parts' geometry, paint or
 * places; `excluded` are the part ids drawn on their own right now.
 *
 * Call it after the other per-frame hooks that show or hide parts, so the
 * batch sees their result in the same frame.
 */
export function useStaticBatch(
  root: RefObject<Group | null>,
  ship: unknown,
  excluded: ReadonlySet<string>
): void {
  const excludedRef = useRef(excluded);
  const batcher = useRef<PartBatcher | null>(null);

  useLayoutEffect(() => {
    excludedRef.current = excluded;
  });

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    const created = new PartBatcher(group, {
      excluded: () => excludedRef.current,
    });
    batcher.current = created;
    return () => {
      created.dispose();
      batcher.current = null;
    };
  }, [root]);

  useLayoutEffect(() => {
    batcher.current?.invalidate();
  }, [ship]);

  useFrame(() => batcher.current?.update(performance.now()));
}

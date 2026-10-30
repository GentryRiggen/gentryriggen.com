import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { Group } from "three";
import PartBatcher from "./PartBatcher";

/**
 * Merges the ship's static parts under `root` into a few draw calls (see
 * PartBatcher.ts). `ship` is whatever changes the parts' geometry, paint or
 * places; the merge follows it once edits go quiet.
 *
 * Call it after the other per-frame hooks that show or hide parts, so the
 * batch sees their result in the same frame.
 */
export function useStaticBatch(
  root: RefObject<Group | null>,
  ship: unknown
): void {
  const batcher = useRef<PartBatcher | null>(null);

  useLayoutEffect(() => {
    const group = root.current;
    if (!group) return;
    const created = new PartBatcher(group);
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

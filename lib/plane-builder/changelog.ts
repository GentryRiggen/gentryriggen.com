/**
 * What changed in each Plane Builder release, newest first. Shown on the
 * Versions page.
 *
 * Every bump of PLANE_BUILDER_VERSION needs a new entry at the top (a test
 * enforces it). Write the notes from the release's commits
 * (`git log <previous release>..HEAD -- lib/plane-builder components/plane-builder app/plane-builder`),
 * in plain words a young pilot or their parent would follow.
 */
export interface Release {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG: readonly Release[] = [
  {
    version: "1.0.0",
    date: "2026-10-11",
    title: "Plane Builder takes off",
    highlights: [
      "Launch your plane from a slingshot and see how far it flies",
      "Earn coins every flight and spend them on wings, engines, fuel and more",
      "Three worlds to beat: the Meadow, the Canyon and the Mountains",
    ],
  },
];

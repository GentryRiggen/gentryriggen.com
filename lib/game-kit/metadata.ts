import type { Metadata, Viewport } from "next";

export type StatusBarStyle = "black" | "black-translucent" | "default";

export interface GameMetadataOptions {
  /** URL slug and file prefix: `/<slug>`, `/<slug>.webmanifest`, `/<slug>-icons/`. */
  slug: string;
  /** Short name, as shown under the home-screen icon. */
  title: string;
  description: string;
  /** Status bar and splash colour; also the fixed theme-color (see lib/theme). */
  themeColor: string;
  /**
   * "black" is opaque. "black-translucent" lets the page run under the status
   * bar, but iOS then blurs the top of it, which smeared Ever Onward's pinned
   * HUD (59beb3fc, 0034ee4c): use it only for a game with no pinned top bar.
   */
  statusBar: StatusBarStyle;
  /**
   * Bump when the icon changes. iOS and Safari keep an icon by its URL, so a
   * new icon needs a new file name (59b9b2f0).
   */
  iconVersion?: number;
  /** Lets a game zoom (a 3D viewer). Default off: fast taps must never zoom. */
  allowZoom?: boolean;
}

/** The icon files a game ships, with the version in the name. */
export function gameIconPaths(slug: string, iconVersion = 1) {
  const base = `/${slug}-icons`;
  const v = `v${iconVersion}`;
  return {
    apple: `${base}/apple-touch-icon-${v}.png`,
    icon192: `${base}/icon-192-${v}.png`,
    icon512: `${base}/icon-512-${v}.png`,
    maskable: `${base}/icon-512-maskable-${v}.png`,
  };
}

/**
 * The page metadata and viewport of a home-screen game, in one place so every
 * game gets the iOS details right: its own manifest (only this route links
 * it), `appleWebApp`, the legacy apple-prefixed capable tag, a versioned apple
 * icon, edge-to-edge layout (viewport-fit cover) and no zoom.
 *
 *   const { metadata, viewport } = gameMetadata({ ... });
 *   export { metadata, viewport };
 */
export function gameMetadata(options: GameMetadataOptions): {
  metadata: Metadata;
  viewport: Viewport;
} {
  const { slug, title, description, themeColor, statusBar } = options;
  const url = `https://gentryriggen.com/${slug}`;
  const icons = gameIconPaths(slug, options.iconVersion);
  return {
    metadata: {
      title: `${title} | Gentry Riggen`,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        siteName: "Gentry Riggen",
        type: "website",
        locale: "en_US",
      },
      twitter: { card: "summary", title, description },
      manifest: `/${slug}.webmanifest`,
      appleWebApp: { capable: true, title, statusBarStyle: statusBar },
      // Next renders `capable` as mobile-web-app-capable; older iOS versions
      // only read the apple- prefixed tag. A page's `other` also replaces the
      // root layout's, which asks for a translucent bar.
      other: { "apple-mobile-web-app-capable": "yes" },
      icons: {
        icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
        apple: [{ url: icons.apple, sizes: "180x180", type: "image/png" }],
      },
    },
    viewport: {
      themeColor,
      width: "device-width",
      initialScale: 1,
      viewportFit: "cover",
      ...(options.allowZoom ? {} : { maximumScale: 1, userScalable: false }),
    },
  };
}

/** The `metadata` of a game's secondary page (its Versions page). */
export function gameSubpageMetadata(
  slug: string,
  title: string,
  page: string,
  description: string
): Metadata {
  return {
    title: `${page} | ${title}`,
    description,
    alternates: { canonical: `https://gentryriggen.com/${slug}/versions` },
  };
}

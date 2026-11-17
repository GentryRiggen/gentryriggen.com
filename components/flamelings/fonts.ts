import { Fredoka } from "next/font/google";

/** The rounded storybook display font, loaded on /flamelings routes only. */
export const flDisplay = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fl-display",
  display: "swap",
});

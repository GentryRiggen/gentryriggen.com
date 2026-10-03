import type { Metadata } from "next";
import ShipBuilder from "@/components/ship-builder/ShipBuilder";

const description =
  "Build your own Titanic-era ocean liner from snap-together parts, then check whether there are enough lifeboats.";

export const metadata: Metadata = {
  title: "Ship Builder | Gentry Riggen",
  description,
  alternates: { canonical: "https://gentryriggen.com/ship-builder" },
  openGraph: {
    title: "Ship Builder",
    description,
    url: "https://gentryriggen.com/ship-builder",
    siteName: "Gentry Riggen",
    type: "website",
  },
};

export default function ShipBuilderPage() {
  return <ShipBuilder />;
}

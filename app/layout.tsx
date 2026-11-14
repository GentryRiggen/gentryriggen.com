import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AnalyticsTracker from "@/components/analytics/AnalyticsTracker";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEME_SCRIPT } from "@/lib/theme/themeScript";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#030712" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://gentryriggen.com"),
  title: "Gentry Riggen",
  description:
    "Gentry Riggen — Software Leader & Developer specializing in React, Next.js, TypeScript, and Node.js. Building products and leading teams to ship exceptional work.",
  keywords: [
    "Gentry Riggen",
    "software engineer",
    "software leader",
    "React",
    "Next.js",
    "TypeScript",
    "Node.js",
    "full stack developer",
    "frontend developer",
    "web developer",
    "GraphQL",
    "Tailwind CSS",
    "React Native",
  ],
  alternates: {
    canonical: "https://gentryriggen.com",
  },
  openGraph: {
    title: "Gentry Riggen",
    description:
      "Software Leader & Developer specializing in React, Next.js, TypeScript, and Node.js. Building products and leading teams to ship exceptional work.",
    url: "https://gentryriggen.com",
    siteName: "Gentry Riggen",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Gentry Riggen",
    description:
      "Software Leader & Developer specializing in React, Next.js, TypeScript, and Node.js. Building products and leading teams to ship exceptional work.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  other: {
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" />
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_SCRIPT,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Person",
                name: "Gentry Riggen",
                url: "https://gentryriggen.com",
                jobTitle: "Software Leader & Developer",
                description:
                  "Software leader and developer specializing in React, Next.js, TypeScript, and Node.js. Building products and leading teams to ship exceptional work.",
                knowsAbout: [
                  "TypeScript",
                  "JavaScript",
                  "React",
                  "Next.js",
                  "Node.js",
                  "GraphQL",
                  "Tailwind CSS",
                  "Docker",
                  "Terraform",
                  "PostgreSQL",
                ],
                sameAs: [
                  "https://linkedin.com/in/gentryriggen",
                  "https://github.com/gentryriggen",
                ],
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "Gentry Riggen",
                url: "https://gentryriggen.com",
              },
            ]),
          }}
        />
      </head>
      {/* Extensions (e.g. ColorZilla) add attributes to <body> before hydration. */}
      <body className="antialiased" suppressHydrationWarning>
        <AnalyticsTracker />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

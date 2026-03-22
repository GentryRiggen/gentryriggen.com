import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

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
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const savedTheme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const theme = savedTheme || (prefersDark ? 'dark' : 'light');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                // Set initial theme-color for iOS Safari browser chrome
                const themeColorMeta = document.querySelector('meta[name="theme-color"]');
                if (themeColorMeta) {
                  themeColorMeta.setAttribute('content', theme === 'dark' ? '#030712' : '#ffffff');
                }
              })();
            `,
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
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

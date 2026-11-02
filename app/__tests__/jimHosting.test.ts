import { readFileSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { siteForPath } from "@/lib/analytics/site";
import { JIM_API } from "@/lib/jim/api";
import { CSP_PLACEHOLDER, applyCsp } from "@/scripts/jim-site.mjs";

interface Header {
  key: string;
  value: string;
}

interface Hosting {
  target: string;
  public: string;
  headers: { source: string; headers: Header[] }[];
  rewrites?: { source: string; destination: string }[];
  redirects?: { source: string; destination: string; type: number }[];
}

const firebaseJson = JSON.parse(
  readFileSync(join(process.cwd(), "firebase.json"), "utf8")
) as { hosting: Hosting[] };

const rc = JSON.parse(
  readFileSync(join(process.cwd(), ".firebaserc"), "utf8")
) as { targets: Record<string, { hosting: Record<string, string[]> }> };

function target(name: string, json = firebaseJson): Hosting {
  const site = json.hosting.find((h) => h.target === name);
  if (!site) throw new Error(`no ${name} hosting target`);
  return site;
}

function headersFor(site: Hosting, source: string): Header[] {
  const rule = site.headers.find((h) => h.source === source);
  if (!rule) throw new Error(`no headers for ${source}`);
  return rule.headers;
}

const FAKE_HASH = "'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='";
const deployed = applyCsp(firebaseJson, [FAKE_HASH]) as { hosting: Hosting[] };
const jim = target("jim", deployed);

function directives(): Map<string, string[]> {
  const csp = headersFor(jim, "**").find(
    (h) => h.key === "Content-Security-Policy"
  )!.value;
  return new Map(
    csp
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .filter((parts) => parts[0])
      .map(([name, ...values]) => [name, values])
  );
}

describe("Jim's own Hosting site", () => {
  it("is a separate target serving only out-jim", () => {
    expect(target("jim").public).toBe("out-jim");
    expect(target("main").public).toBe("out");
    expect(rc.targets.gentryriggen.hosting).toEqual({
      main: ["gentryriggen"],
      jim: ["jim-gentryriggen"],
    });
  });

  it("serves the Jim page at every /jim/… address, like the e2e server", () => {
    const rule = { source: "/jim/**", destination: "/jim.html" };
    expect(jim.rewrites).toContainEqual(rule);
    const local = JSON.parse(
      readFileSync(join(process.cwd(), "e2e/serve.json"), "utf8")
    ) as { rewrites: unknown[] };
    expect(local.rewrites).toContainEqual(rule);
  });

  it("sends / to /jim without making it permanent", () => {
    expect(jim.redirects).toContainEqual({
      source: "/",
      destination: "/jim",
      type: 302,
    });
  });

  it("commits the placeholder, which the deploy fills in", () => {
    const committed = headersFor(target("jim"), "**").find(
      (h) => h.key === "Content-Security-Policy"
    )!.value;
    expect(committed).toContain(CSP_PLACEHOLDER);
  });

  it("locks everything down by default", () => {
    const d = directives();
    expect(d.get("default-src")).toEqual(["'none'"]);
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'none'"]);
    expect(d.get("frame-ancestors")).toEqual(["'none'"]);
    expect(d.get("frame-src")).toEqual(["'none'"]);
    expect(d.get("form-action")).toEqual(["'self'"]);
    expect(d.get("worker-src")).toEqual(["'self'"]);
    expect(d.get("manifest-src")).toEqual(["'self'"]);
  });

  it("runs only its own scripts and the hashed inline ones", () => {
    const scriptSrc = directives().get("script-src")!;
    expect(scriptSrc).toEqual(["'self'", FAKE_HASH]);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("talks only to itself, the Jim server and Google sign-in", () => {
    const connectSrc = directives().get("connect-src")!;
    expect(connectSrc).toEqual([
      "'self'",
      "https://jim-997603129413.us-central1.run.app",
      "https://identitytoolkit.googleapis.com",
      "https://securetoken.googleapis.com",
    ]);
    expect(connectSrc.some((s) => s.includes("*"))).toBe(false);
    expect(connectSrc).toContain(new URL(JIM_API).origin);
  });

  it.each([
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "no-referrer"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
    ["X-Frame-Options", "DENY"],
    ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
    [
      "Permissions-Policy",
      "camera=(), geolocation=(), payment=(), usb=(), microphone=(self), publickey-credentials-get=(self), publickey-credentials-create=(self)",
    ],
  ])("sends %s on every response", (key, value) => {
    expect(headersFor(jim, "**")).toContainEqual({ key, value });
  });

  it.each([
    "/jim",
    "/jim/**",
    "/jim.html",
    "/jim-sw.js",
    "/jim.webmanifest",
    "/jim-icons/**",
    "/jim/version.json",
  ])("serves %s fresh, so updates land", (source) => {
    expect(headersFor(jim, source)).toContainEqual({
      key: "Cache-Control",
      value: "no-cache",
    });
  });

  it("caches built scripts for a year (their names change with content)", () => {
    expect(headersFor(jim, "/_next/**/*.js")).toContainEqual({
      key: "Cache-Control",
      value: "max-age=31536000",
    });
  });
});

describe("the main site", () => {
  const main = target("main");

  it("no longer serves the Jim page", () => {
    expect(
      (main.rewrites ?? []).some((r) => r.destination === "/jim.html")
    ).toBe(false);
    expect(main.rewrites).toContainEqual({
      source: "/jim/**",
      destination: "/jim-moved.html",
    });
  });

  it("drops Jim's old CSP blocks (only the moved page's strict one)", () => {
    for (const rule of main.headers) {
      if (!rule.source.startsWith("/jim")) continue;
      for (const header of rule.headers) {
        if (header.key !== "Content-Security-Policy") continue;
        expect(header.value).toBe(
          "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"
        );
      }
    }
  });
});

it("keeps /jim out of the sitemap and the pageview analytics", () => {
  expect(sitemap().some((entry) => entry.url.includes("/jim"))).toBe(false);
  expect(siteForPath("/jim")).toBeNull();
  expect(siteForPath("/jim/notes/people/sam-okafor")).toBeNull();
});

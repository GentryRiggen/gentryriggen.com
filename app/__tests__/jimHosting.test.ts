import { readFileSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { siteForPath } from "@/lib/analytics/site";
import { JIM_API } from "@/lib/jim/api";

interface Header {
  key: string;
  value: string;
}

const hosting = JSON.parse(
  readFileSync(join(process.cwd(), "firebase.json"), "utf8")
).hosting as { headers: { source: string; headers: Header[] }[] };

function headersFor(source: string): Header[] {
  const rule = hosting.headers.find((h) => h.source === source);
  if (!rule) throw new Error(`no headers for ${source}`);
  return rule.headers;
}

it.each(["/jim", "/jim.html"])(
  "%s cannot be framed and only talks to itself and Google auth",
  (source) => {
    const headers = headersFor(source);
    expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toContain("frame-ancestors 'none'");
    expect(csp?.value).toMatch(
      /connect-src 'self' .*https:\/\/securetoken\.googleapis\.com.*https:\/\/identitytoolkit\.googleapis\.com/
    );
  }
);

it("keeps /jim out of the sitemap and the pageview analytics", () => {
  expect(sitemap().some((entry) => entry.url.includes("/jim"))).toBe(false);
  expect(siteForPath("/jim")).toBeNull();
});

// The page can only reach the server if the CSP lists it on both paths
// Firebase Hosting serves the page from.
it.each(["/jim", "/jim.html"])(
  "%s lets the page call the server in JIM_API",
  (source) => {
    expect(JIM_API).toMatch(/^https:\/\//);
    const csp = headersFor(source).find(
      (h) => h.key === "Content-Security-Policy"
    );
    const connectSrc = csp?.value
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith("connect-src "));
    expect(connectSrc?.split(/\s+/)).toContain(new URL(JIM_API).origin);
  }
);

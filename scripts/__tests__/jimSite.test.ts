import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  CSP_PLACEHOLDER,
  applyCsp,
  forbiddenRefs,
  hasTestHooks,
  inlineScriptHashes,
  jimFiles,
  pageChunks,
  run,
  unhashedProblems,
} from "../jim-site.mjs";

const sha = (text: string) =>
  `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;

interface Hosting {
  target: string;
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

function config(
  csp = `script-src 'self' ${CSP_PLACEHOLDER}; object-src 'none'`
) {
  return {
    hosting: [
      { target: "main", public: "out", headers: [] },
      {
        target: "jim",
        public: "out-jim",
        headers: [
          {
            source: "**",
            headers: [{ key: "Content-Security-Policy", value: csp }],
          },
        ],
      },
    ],
  };
}

function cspOf(cfg: { hosting: unknown }): string {
  const jim = (cfg.hosting as Hosting[]).find((h) => h.target === "jim")!;
  return jim.headers[0].headers[0].value;
}

describe("inlineScriptHashes", () => {
  it("hashes only inline scripts that run", () => {
    const hashes = inlineScriptHashes(
      '<script>a()</script><script src="/x.js"></script><script type="application/ld+json">{}</script>'
    );
    expect(hashes).toEqual([sha("a()")]);
  });

  it("hashes module and javascript-typed scripts, not JSON data", () => {
    const html =
      '<script type="module">m()</script>' +
      '<script type="text/javascript">t()</script>' +
      '<script type="application/json">{"a":1}</script>' +
      '<script id="_R_" async>b()</script>';
    expect(inlineScriptHashes(html)).toEqual([
      sha("m()"),
      sha("t()"),
      sha("b()"),
    ]);
  });

  it("hashes the text the browser sees (line endings normalized)", () => {
    expect(inlineScriptHashes("<script>a();\r\nb()</script>")).toEqual([
      sha("a();\nb()"),
    ]);
  });

  it("skips empty inline scripts and drops duplicates", () => {
    expect(
      inlineScriptHashes(
        "<script></script><script>a()</script><script>a()</script>"
      )
    ).toEqual([sha("a()")]);
  });
});

describe("applyCsp", () => {
  it("puts the hashes where the placeholder was", () => {
    const out = applyCsp(config(), [sha("a()"), sha("b()")]);
    expect(cspOf(out)).toBe(
      `script-src 'self' ${sha("a()")} ${sha("b()")}; object-src 'none'`
    );
  });

  it("leaves the input alone", () => {
    const input = config();
    applyCsp(input, [sha("a()")]);
    expect(cspOf(input)).toContain(CSP_PLACEHOLDER);
  });

  it("throws when the placeholder is gone", () => {
    expect(() => applyCsp(config("script-src 'self'"), [sha("a()")])).toThrow(
      /placeholder/
    );
  });

  it("throws when there is no jim hosting target", () => {
    expect(() => applyCsp({ hosting: { public: "out" } }, [])).toThrow(/jim/);
  });
});

describe("jimFiles", () => {
  it("keeps Jim's page and assets and drops every other page", () => {
    expect(
      jimFiles([
        "jim.html",
        "_next/static/x.js",
        "jim-icons/a.png",
        "jim/version.json",
        "jim-sw.js",
        "jim.webmanifest",
        "icon.svg",
        "ship-builder.html",
        "admin.html",
        "index.html",
        "404.html",
        "jim.txt",
        "jim/__next._tree.txt",
        "ship-builder-sw.js",
        "robots.txt",
        "sitemap.xml",
        "jim-icons-evil/x.png",
      ]).sort()
    ).toEqual(
      [
        "_next/static/x.js",
        "icon.svg",
        "jim-icons/a.png",
        "jim-sw.js",
        "jim.html",
        "jim.webmanifest",
        "jim/version.json",
      ].sort()
    );
  });
});

describe("hasTestHooks", () => {
  it.each(["window.__JIM_TEST__", 'async()=>"e2e-token"'])("finds %s", (js) => {
    expect(hasTestHooks(js)).toBe(true);
  });

  it("passes ordinary code", () => {
    expect(hasTestHooks("let a=1;fetch('/api/view')")).toBe(false);
  });
});

describe("forbiddenRefs", () => {
  it.each([
    "https://www.google.com/recaptcha/enterprise.js",
    "https://firebaseappcheck.googleapis.com/v1/x",
    "X-Firebase-AppCheck",
    "https://www.gstatic.com/x.js",
    "https://www.googletagmanager.com/gtag/js",
    "documents/pageviews/abc",
  ])("flags %s", (text) => {
    expect(forbiddenRefs(`x=${JSON.stringify(text)}`)).not.toEqual([]);
  });

  it("passes the shared config's site key field (it loads nothing)", () => {
    expect(forbiddenRefs('c={projectId:"p",recaptchaSiteKey:"k"}')).toEqual([]);
  });

  it("flags the reCAPTCHA global", () => {
    expect(forbiddenRefs("window.grecaptcha.enterprise.ready(f)")).not.toEqual(
      []
    );
  });

  it("passes Jim's own endpoints", () => {
    expect(
      forbiddenRefs(
        "https://identitytoolkit.googleapis.com https://securetoken.googleapis.com /api/view"
      )
    ).toEqual([]);
  });
});

describe("pageChunks", () => {
  it("lists the scripts the page loads, from tags and the RSC payload", () => {
    const html =
      '<script src="/_next/static/chunks/a.js" async=""></script>' +
      '<script>self.__next_f.push([1,"2:I[1,[\\"/_next/static/chunks/b.js\\"]]"])</script>';
    expect(pageChunks(html).sort()).toEqual([
      "_next/static/chunks/a.js",
      "_next/static/chunks/b.js",
    ]);
  });
});

describe("unhashedProblems", () => {
  it("is happy when every inline script is in the CSP", () => {
    const html = "<script>a()</script>";
    expect(unhashedProblems(html, `script-src 'self' ${sha("a()")}`)).toEqual(
      []
    );
  });

  it("reports an inline script missing from the CSP", () => {
    const html = "<script>a()</script>";
    expect(unhashedProblems(html, "script-src 'self'")).not.toEqual([]);
  });

  it("reports inline event handlers (a hash can't allow them)", () => {
    const html = '<img src="x" onerror="go()">';
    expect(unhashedProblems(html, "script-src 'self'")).not.toEqual([]);
  });

  it("reports a script tag it can't parse", () => {
    const html = "<script>a()";
    expect(unhashedProblems(html, "script-src 'self'")).not.toEqual([]);
  });
});

describe("run", () => {
  let dir: string;

  function put(path: string, text: string) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }

  const JIM_PAGE =
    '<html><head><script src="/_next/static/chunks/page.js" async=""></script>' +
    "<script>theme()</script></head><body></body></html>";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "jim-site-"));
    put("out/jim.html", JIM_PAGE);
    put("out/_next/static/chunks/page.js", "render()");
    put("out/_next/static/chunks/other.js", "game()");
    put("out/jim-sw.js", "sw()");
    put("out/jim-sw-kill.js", "kill()");
    put("out/jim-moved.html", '<script src="/jim-moved.js"></script>');
    put("out/jim-moved.js", "moved()");
    put("out/admin.html", "<html></html>");
    put("out/index.html", "<html></html>");
    put("firebase.json", JSON.stringify(config()));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const opts = (extra = {}) => ({
    out: join(dir, "out"),
    dest: join(dir, "out-jim"),
    config: join(dir, "firebase.json"),
    env: {},
    ...extra,
  });

  it("copies only Jim, adds a script-free 404 and hashes the CSP", () => {
    run(opts());
    expect(existsSync(join(dir, "out-jim/jim.html"))).toBe(true);
    expect(existsSync(join(dir, "out-jim/jim-sw.js"))).toBe(true);
    expect(existsSync(join(dir, "out-jim/_next/static/chunks/page.js"))).toBe(
      true
    );
    expect(existsSync(join(dir, "out-jim/admin.html"))).toBe(false);
    expect(existsSync(join(dir, "out-jim/index.html"))).toBe(false);
    const notFound = readFileSync(join(dir, "out-jim/404.html"), "utf8");
    expect(notFound).toContain('href="/jim"');
    expect(notFound).not.toMatch(/<script/i);
    const written = JSON.parse(
      readFileSync(join(dir, "firebase.json"), "utf8")
    );
    expect(cspOf(written)).toBe(
      `script-src 'self' ${sha("theme()")}; object-src 'none'`
    );
  });

  it("--check writes nothing", () => {
    run(opts({ check: true }));
    expect(existsSync(join(dir, "out-jim"))).toBe(false);
    expect(readFileSync(join(dir, "firebase.json"), "utf8")).toContain(
      CSP_PLACEHOLDER
    );
  });

  it("clears an old out-jim first", () => {
    put("out-jim/admin.html", "stale");
    run(opts());
    expect(existsSync(join(dir, "out-jim/admin.html"))).toBe(false);
  });

  it("fails when jim.html is missing", () => {
    rmSync(join(dir, "out/jim.html"));
    expect(() => run(opts())).toThrow(/jim\.html is missing/);
  });

  it("fails when the placeholder is gone", () => {
    put("firebase.json", JSON.stringify(config("script-src 'self'")));
    expect(() => run(opts())).toThrow(/placeholder/);
  });

  it("fails when a shipped chunk has test hooks", () => {
    put("out/_next/static/chunks/other.js", 'x=async()=>"e2e-token"');
    expect(() => run(opts())).toThrow(/test hooks/);
  });

  it("allows test hooks in an e2e build", () => {
    put("out/_next/static/chunks/other.js", "window.__JIM_TEST__");
    expect(() => run(opts({ env: { NEXT_PUBLIC_E2E: "1" } }))).not.toThrow();
  });

  it("fails when the page loads App Check, reCAPTCHA or analytics", () => {
    put(
      "out/_next/static/chunks/page.js",
      'load("https://www.google.com/recaptcha/enterprise.js")'
    );
    expect(() => run(opts())).toThrow(/recaptcha/i);
  });

  it("leaves the main site the kill switch and the moved page, not Jim", () => {
    put("out/jim.txt", "rsc");
    put("out/jim.webmanifest", "{}");
    put("out/jim-icons/icon-192.png", "png");
    put("out/jim/version.json", '{"build":"b"}');
    put("out/jim/__next._full.txt", "rsc");
    run(opts());
    const read = (p: string) => readFileSync(join(dir, p), "utf8");
    expect(read("out-jim/jim-sw.js")).toBe("sw()");
    expect(read("out-jim/jim.webmanifest")).toBe("{}");
    expect(existsSync(join(dir, "out-jim/jim-moved.html"))).toBe(false);
    expect(existsSync(join(dir, "out-jim/jim-sw-kill.js"))).toBe(false);
    expect(read("out/jim-sw.js")).toBe("kill()");
    for (const gone of [
      "out/jim.html",
      "out/jim.txt",
      "out/jim.webmanifest",
      "out/jim-icons",
      "out/jim/__next._full.txt",
    ]) {
      expect(existsSync(join(dir, gone))).toBe(false);
    }
    // An open old page still sees a new build, so its next reload moves it.
    expect(read("out/jim/version.json")).toBe('{"build":"b"}');
    expect(existsSync(join(dir, "out/jim-moved.html"))).toBe(true);
    expect(existsSync(join(dir, "out/admin.html"))).toBe(true);
  });

  it("--check leaves out/ as it is", () => {
    run(opts({ check: true }));
    expect(readFileSync(join(dir, "out/jim-sw.js"), "utf8")).toBe("sw()");
    expect(existsSync(join(dir, "out/jim.html"))).toBe(true);
  });

  it.each(["jim-sw-kill.js", "jim-moved.html", "jim-moved.js"])(
    "fails, writing nothing, when the build has no %s",
    (file) => {
      rmSync(join(dir, "out", file));
      expect(() => run(opts())).toThrow(file);
      expect(() => run(opts({ check: true }))).toThrow(file);
      expect(existsSync(join(dir, "out-jim"))).toBe(false);
      expect(readFileSync(join(dir, "out/jim-sw.js"), "utf8")).toBe("sw()");
    }
  );

  it("refuses a second run (out/ no longer has Jim)", () => {
    run(opts());
    expect(() => run(opts())).toThrow(/jim\.html is missing/);
    expect(readFileSync(join(dir, "out-jim/jim-sw.js"), "utf8")).toBe("sw()");
  });

  it("fails when the page has an inline handler a hash can't cover", () => {
    put("out/jim.html", JIM_PAGE.replace("<body>", '<body onload="x()">'));
    expect(() => run(opts())).toThrow(/inline/);
  });
});

describe("the main site in firebase.json", () => {
  // default-src 'none' also leaves the stub no connect-src, img-src or frames.
  const STUB_CSP =
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'";
  const main = (
    JSON.parse(readFileSync(join(process.cwd(), "firebase.json"), "utf8"))
      .hosting as (Hosting & {
      rewrites: { source: string; destination: string }[];
    })[]
  ).find((site) => site.target === "main")!;

  /** Every header the rules for exactly this source set. */
  const headersFor = (source: string) =>
    Object.fromEntries(
      main.headers
        .filter((rule) => rule.source === source)
        .flatMap((rule) => rule.headers.map((h) => [h.key, h.value]))
    );

  it.each(["/jim", "/jim/**", "/jim.html"])(
    "answers %s with the moved page under its strict CSP",
    (source) => {
      expect(main.rewrites).toContainEqual({
        source,
        destination: "/jim-moved.html",
      });
      // Hosting matches headers on the address asked for, not the rewrite.
      expect(headersFor(source)).toEqual({
        "Content-Security-Policy": STUB_CSP,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
    }
  );

  it("never caches the moved page, its script or the kill switch", () => {
    // cleanUrls serves /jim-moved.html as /jim-moved too.
    for (const source of ["/jim-moved", "/jim-moved.html"]) {
      expect(headersFor(source)).toEqual({
        "Content-Security-Policy": STUB_CSP,
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
    }
    expect(headersFor("/jim-moved.js")).toEqual({
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    expect(headersFor("/jim-sw.js")).toEqual({
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
  });
});

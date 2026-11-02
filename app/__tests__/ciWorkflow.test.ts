import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
}

interface Job {
  if?: string;
  permissions?: Record<string, string>;
  steps: Step[];
}

const source = readFileSync(
  join(process.cwd(), ".github/workflows/ci.yml"),
  "utf8"
);
const workflow = parse(source) as { jobs: Record<string, Job> };
const deploy = workflow.jobs.deploy;
const build = workflow.jobs.build;

const SHA_PIN = /^[^@\s]+@[0-9a-f]{40}$/;

function stepIndex(job: Job, match: (step: Step) => boolean): number {
  const i = job.steps.findIndex(match);
  if (i < 0) throw new Error("step not found");
  return i;
}

describe("CI deploy job (keyless)", () => {
  it("can mint an OIDC token and nothing more", () => {
    expect(deploy.permissions).toEqual({
      contents: "read",
      "id-token": "write",
    });
  });

  it("deploys only from a push to main", () => {
    expect(deploy.if).toContain("github.event_name == 'push'");
    expect(deploy.if).toContain("github.ref == 'refs/heads/main'");
  });

  it("pins every action to a full commit SHA", () => {
    const uses = deploy.steps.flatMap((s) => (s.uses ? [s.uses] : []));
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) {
      expect(u).toMatch(SHA_PIN);
      expect(u).not.toMatch(/@v\d+$/);
    }
    // The comment after each pin names the tag it was taken from.
    const deployText = source.slice(source.indexOf("\n  deploy:"));
    for (const line of deployText.split("\n")) {
      if (/^\s*(- )?uses: /.test(line)) {
        expect(line).toMatch(/@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
      }
    }
  });

  it("authenticates through Workload Identity Federation", () => {
    const auth = deploy.steps.find((s) =>
      s.uses?.startsWith("google-github-actions/auth@")
    );
    expect(auth?.uses).toBe(
      "google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093"
    );
    expect(auth?.with?.workload_identity_provider).toBe(
      "${{ vars.GCP_WIF_PROVIDER }}"
    );
    expect(auth?.with?.service_account).toBe("${{ vars.GCP_DEPLOYER_SA }}");
    expect(auth?.with).not.toHaveProperty("credentials_json");
  });

  it("fails clearly before auth when the WIF variables are missing", () => {
    const check = stepIndex(
      deploy,
      (s) =>
        !!s.run?.includes("GCP_WIF_PROVIDER") && !!s.run.includes("::error::")
    );
    const auth = stepIndex(
      deploy,
      (s) => !!s.uses?.startsWith("google-github-actions/auth@")
    );
    expect(check).toBeLessThan(auth);
    expect(deploy.steps[check].run).toContain("GCP_DEPLOYER_SA");
  });

  it("never reads a service account key", () => {
    expect(source).not.toContain("secrets.FIREBASE_SERVICE_ACCOUNT");
    expect(source).not.toContain("action-hosting-deploy");
    expect(source).not.toContain("credentials_json");
    expect(source).not.toMatch(/sa\.json/);
  });

  it("runs the lockfile's exact firebase-tools, installed without scripts", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies["firebase-tools"]).toBe("15.34.1");
    const lock = JSON.parse(
      readFileSync(join(process.cwd(), "package-lock.json"), "utf8")
    ) as { packages: Record<string, { version: string }> };
    expect(lock.packages["node_modules/firebase-tools"].version).toBe(
      "15.34.1"
    );

    const install = stepIndex(deploy, (s) => !!s.run?.includes("npm ci"));
    expect(deploy.steps[install].run).toContain("--ignore-scripts");
    const auth = stepIndex(
      deploy,
      (s) => !!s.uses?.startsWith("google-github-actions/auth@")
    );
    expect(install).toBeLessThan(auth);

    const calls = deploy.steps.filter((s) => s.run?.includes("firebase-tools"));
    expect(calls.length).toBe(2);
    for (const s of calls) {
      expect(s.run).toMatch(/^npx --no-install firebase-tools deploy /);
    }
    expect(source).not.toMatch(/npx --yes/);
    expect(source).not.toMatch(/firebase-tools@/);
  });

  it("deploys both Hosting sites and the rules after building Jim's site", () => {
    const jimSite = stepIndex(
      deploy,
      (s) => s.run?.trim() === "node scripts/jim-site.mjs"
    );
    const auth = stepIndex(
      deploy,
      (s) => !!s.uses?.startsWith("google-github-actions/auth@")
    );
    const hosting = stepIndex(
      deploy,
      (s) =>
        !!s.run?.includes("--only hosting:main,hosting:jim,firestore:rules")
    );
    const indexes = stepIndex(
      deploy,
      (s) => !!s.run?.includes("--only firestore:indexes")
    );
    expect(jimSite).toBeLessThan(hosting);
    expect(auth).toBeLessThan(hosting);
    expect(hosting).toBeLessThan(indexes);
    for (const i of [hosting, indexes]) {
      expect(deploy.steps[i].run).toContain("--project gentryriggen");
      expect(deploy.steps[i].run).toContain("--non-interactive");
    }
  });
});

describe("CI permissions", () => {
  it("gives the OIDC token to the deploy job only", () => {
    const top = (parse(source) as { permissions?: Record<string, string> })
      .permissions;
    expect(top).toEqual({ contents: "read" });
    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (name === "deploy") continue;
      expect(job.permissions ?? {}).not.toHaveProperty("id-token");
    }
  });
});

describe("CI build job", () => {
  it("pins every action the shipped build passes through", () => {
    const uses = build.steps.flatMap((s) =>
      s.uses && !s.uses.startsWith("./") ? [s.uses] : []
    );
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(SHA_PIN);

    const setup = parse(
      readFileSync(
        join(process.cwd(), ".github/actions/setup/action.yml"),
        "utf8"
      )
    ) as { runs: { steps: Step[] } };
    for (const s of setup.runs.steps) {
      if (s.uses) expect(s.uses).toMatch(SHA_PIN);
    }
  });

  it("checks Jim's site after the build", () => {
    const b = stepIndex(build, (s) => s.run?.trim() === "npm run build");
    const check = stepIndex(
      build,
      (s) => s.run?.trim() === "node scripts/jim-site.mjs --check"
    );
    expect(b).toBeLessThan(check);
  });

  it("requires Jim's tenant on main and builds it in", () => {
    const gate = build.steps.find((s) => s.env?.JIM_TENANT !== undefined);
    expect(gate?.if).toContain("refs/heads/main");
    expect(gate?.run).toContain("exit 1");
    const b = build.steps.find((s) => s.run?.trim() === "npm run build");
    expect(b?.env?.NEXT_PUBLIC_JIM_TENANT).toBe("${{ vars.JIM_TENANT }}");
  });
});

describe("Renovate", () => {
  const renovate = JSON.parse(
    readFileSync(join(process.cwd(), "renovate.json"), "utf8")
  ) as { packageRules: Record<string, unknown>[] };
  // Later rules win, so each guard must come after every automerge rule.
  function lastRuleFor(key: string, value: string) {
    const i = renovate.packageRules.findLastIndex((r) =>
      (r[key] as string[] | undefined)?.includes(value)
    );
    const lastAutomerge = renovate.packageRules.findLastIndex(
      (r) => r.automerge === true
    );
    expect(i).toBeGreaterThan(lastAutomerge);
    return renovate.packageRules[i];
  }

  it("never auto-merges action or firebase-tools updates", () => {
    for (const rule of [
      lastRuleFor("matchManagers", "github-actions"),
      lastRuleFor("matchPackageNames", "firebase-tools"),
    ]) {
      expect(rule.automerge).toBe(false);
      expect(rule.minimumReleaseAge).toBe("14 days");
    }
  });
});

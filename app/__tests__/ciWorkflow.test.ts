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

  it("uses one exact firebase-tools version everywhere", () => {
    const versions = [...source.matchAll(/firebase-tools@(\S+)/g)].map(
      (m) => m[1]
    );
    expect(versions.length).toBeGreaterThanOrEqual(2);
    for (const v of versions) expect(v).toBe("15.34.1");
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

describe("CI build job", () => {
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

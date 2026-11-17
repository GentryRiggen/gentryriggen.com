import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  COLOURS,
  EYES,
  FACES,
  HATS,
  NECKS,
  SHAPES,
} from "@/lib/flamelings/catalog";
import { FORMS } from "@/lib/flamelings/forms";
import { STAGES } from "@/lib/flamelings/progress";
import { CODE_ALPHABET } from "@/lib/flamelings/online/card";
import {
  createCard,
  createVisit,
  deleteVisit,
  getCard,
  listVisits,
  updateCard,
  utcDay,
} from "@/lib/flamelings/online/client";
import { ONLINE_NAMES } from "@/lib/flamelings/online/names";
import type { PetCard } from "@/lib/flamelings/types";

const PROJECT_ID = "demo-gentryriggen";
const [HOST, PORT] = (
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
).split(":");

const config = {
  apiKey: "emulator",
  authDomain: "x",
  projectId: PROJECT_ID,
  appId: "x",
};
const baseUrl = `http://${HOST}:${PORT}`;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: HOST,
      port: Number(PORT),
    },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

const ALICE = "alice-uid";
const BOB = "bob-uid";
const EVE = "eve-uid";
const A = "ABCDEF";
const B = "GHJKMN";
const C = "PQRSTU";

const as = (uid: string) =>
  env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } })
    .firestore();
const signedOut = () => env.unauthenticatedContext().firestore();
/** A signed-in account that is not anonymous (the admin's, for example). */
const emailUser = (uid: string) =>
  env
    .authenticatedContext(uid, { firebase: { sign_in_provider: "password" } })
    .firestore();

const today = () => new Date().toISOString().slice(0, 10);
const dayOffset = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const look = {
  colour: "ember",
  shape: "flame",
  eyes: "round",
  hat: "none",
  face: "none",
  neck: "none",
};

function card(uid: string, patch: Record<string, unknown> = {}) {
  return {
    uid,
    look: { ...look },
    level: 3,
    stage: "flicker",
    form: "none",
    nameId: 4,
    updatedAt: serverTimestamp(),
    ...patch,
  };
}

/** A card written with the rules off, last updated `ageMs` ago. */
async function seedCard(code: string, uid: string, ageMs = 60_000) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `flPets/${code}`), {
      ...card(uid),
      updatedAt: new Date(Date.now() - ageMs),
    });
  });
}

async function seedVisit(to: string, from: string, day = today()) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `flPets/${to}/visits/${from}_${day}`), {
      from,
      day,
      createdAt: new Date(),
    });
  });
}

function visit(from: string, patch: Record<string, unknown> = {}) {
  return { from, day: today(), createdAt: serverTimestamp(), ...patch };
}

const visitPath = (to: string, from: string, day = today()) =>
  `flPets/${to}/visits/${from}_${day}`;

describe("flPets cards: create", () => {
  it("lets a signed-in player create a valid card for their own uid", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE)));
  });

  it("denies a signed-out player", async () => {
    await assertFails(setDoc(doc(signedOut(), `flPets/${A}`), card(ALICE)));
  });

  it("denies a signed-in account that is not anonymous", async () => {
    await assertFails(
      setDoc(doc(emailUser(ALICE), `flPets/${A}`), card(ALICE))
    );
  });

  it("denies a card for someone else's uid", async () => {
    await assertFails(setDoc(doc(as(EVE), `flPets/${A}`), card(ALICE)));
  });

  it.each([
    "abcdef",
    "ABCDE",
    "ABCDEFG",
    "ABCDE0",
    "ABCDEO",
    "ABCDE1",
    "ABCDEI",
    "ABCDEL",
    "ABC DE",
    "ABCDE-",
  ])("denies the bad code %s", async (code) => {
    await assertFails(setDoc(doc(as(ALICE), `flPets/${code}`), card(ALICE)));
  });

  it("allows every character of the alphabet in a code", async () => {
    for (const ch of CODE_ALPHABET) {
      await assertSucceeds(
        setDoc(doc(as(ALICE), `flPets/${ch.repeat(6)}`), card(ALICE))
      );
    }
  });

  it("denies creating over someone else's existing card", async () => {
    await seedCard(A, ALICE);
    await assertFails(setDoc(doc(as(EVE), `flPets/${A}`), card(EVE)));
  });

  it("denies a duplicate create by the owner when rewritten too soon", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE)));
    await assertFails(setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE)));
  });

  it("denies an extra field", async () => {
    await assertFails(
      setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE, { name: "Pip" }))
    );
  });

  it.each(["uid", "look", "level", "stage", "form", "nameId", "updatedAt"])(
    "denies a card missing %s",
    async (field) => {
      const data: Record<string, unknown> = card(ALICE);
      delete data[field];
      await assertFails(setDoc(doc(as(ALICE), `flPets/${A}`), data));
    }
  );

  it("denies an updatedAt that is not the server time", async () => {
    await assertFails(
      setDoc(
        doc(as(ALICE), `flPets/${A}`),
        card(ALICE, { updatedAt: new Date(Date.now() + 3_600_000) })
      )
    );
  });

  it.each([
    ["level 0", { level: 0 }],
    ["level 100", { level: 100 }],
    ["level as a string", { level: "3" }],
    ["level as a float", { level: 3.5 }],
    ["unknown stage", { stage: "inferno" }],
    ["unknown form", { form: "scary" }],
    ["form null", { form: null }],
    ["nameId below 0", { nameId: -1 }],
    ["nameId at the list length", { nameId: ONLINE_NAMES.length }],
    ["nameId as a string", { nameId: "Pip" }],
    ["nameId as a float", { nameId: 1.5 }],
    ["uid as a number", { uid: 5 }],
    ["look as a string", { look: "ember" }],
    ["look null", { look: null }],
  ])("denies %s", async (_label, patch) => {
    await assertFails(
      setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE, patch))
    );
  });

  it.each([
    ["an unknown colour", { colour: "pink" }],
    ["an unknown shape", { shape: "star" }],
    ["unknown eyes", { eyes: "laser" }],
    ["an unknown hat", { hat: "tinfoil" }],
    ["an unknown face", { face: "mask" }],
    ["an unknown neck", { neck: "chain" }],
    ["a free-text hat", { hat: "Call me on 555-1234" }],
    ["an empty colour", { colour: "" }],
    ["a number as the colour", { colour: 1 }],
    ["an oversized value", { colour: "x".repeat(5000) }],
    ["an extra look key", { extra: "x" }],
  ])("denies a look with %s", async (_label, patch) => {
    await assertFails(
      setDoc(
        doc(as(ALICE), `flPets/${A}`),
        card(ALICE, { look: { ...look, ...patch } })
      )
    );
  });

  it.each(["colour", "shape", "eyes", "hat", "face", "neck"])(
    "denies a look missing %s",
    async (key) => {
      const l: Record<string, string> = { ...look };
      delete l[key];
      await assertFails(
        setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE, { look: l }))
      );
    }
  );

  it("allows every enum value the catalog has", async () => {
    let n = 0;
    const next = () => {
      n += 1;
      return `AAAA${CODE_ALPHABET[Math.floor(n / 31) % 31]}${CODE_ALPHABET[n % 31]}`;
    };
    const tries: Record<string, unknown>[] = [
      ...COLOURS.map((colour) => ({ look: { ...look, colour } })),
      ...SHAPES.map((shape) => ({ look: { ...look, shape } })),
      ...EYES.map((eyes) => ({ look: { ...look, eyes } })),
      ...HATS.map((hat) => ({ look: { ...look, hat } })),
      ...FACES.map((face) => ({ look: { ...look, face } })),
      ...NECKS.map((neck) => ({ look: { ...look, neck } })),
      ...STAGES.map((s) => ({ stage: s.id })),
      ...FORMS.map((form) => ({ form })),
      { level: 1 },
      { level: 99 },
      { nameId: 0 },
      { nameId: ONLINE_NAMES.length - 1 },
    ];
    for (const patch of tries) {
      await assertSucceeds(
        setDoc(doc(as(ALICE), `flPets/${next()}`), card(ALICE, patch))
      );
    }
  });
});

describe("flPets cards: read", () => {
  it("lets any signed-in player get a card by code", async () => {
    await seedCard(A, ALICE);
    await assertSucceeds(getDoc(doc(as(BOB), `flPets/${A}`)));
  });

  it("denies a signed-out get", async () => {
    await seedCard(A, ALICE);
    await assertFails(getDoc(doc(signedOut(), `flPets/${A}`)));
  });

  it("denies listing the collection, even for the owner", async () => {
    await seedCard(A, ALICE);
    await assertFails(getDocs(collection(as(ALICE), "flPets")));
    await assertFails(getDocs(collection(as(BOB), "flPets")));
  });

  it("denies a filtered query that would find cards", async () => {
    await seedCard(A, ALICE);
    await assertFails(
      getDocs(query(collection(as(ALICE), "flPets"), where("uid", "==", ALICE)))
    );
    await assertFails(
      getDocs(query(collection(as(BOB), "flPets"), where("level", ">=", 1)))
    );
  });

  it("denies a collection-group query for visits", async () => {
    await seedCard(A, ALICE);
    await seedCard(B, BOB);
    await seedVisit(A, B);
    const { collectionGroup } = await import("firebase/firestore");
    await assertFails(getDocs(collectionGroup(as(ALICE), "visits")));
  });
});

describe("flPets cards: update and delete", () => {
  it("lets the owner update after 10 seconds", async () => {
    await seedCard(A, ALICE, 60_000);
    await assertSucceeds(
      setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE, { level: 4 }))
    );
  });

  it("denies a second update within 10 seconds", async () => {
    await seedCard(A, ALICE, 60_000);
    const db = as(ALICE);
    await assertSucceeds(setDoc(doc(db, `flPets/${A}`), card(ALICE)));
    await assertFails(
      setDoc(doc(db, `flPets/${A}`), card(ALICE, { level: 5 }))
    );
  });

  it("denies an update 5 seconds after the last write", async () => {
    await seedCard(A, ALICE, 5_000);
    await assertFails(setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE)));
  });

  it("denies an update by another player", async () => {
    await seedCard(A, ALICE);
    await assertFails(setDoc(doc(as(EVE), `flPets/${A}`), card(ALICE)));
    await assertFails(setDoc(doc(as(EVE), `flPets/${A}`), card(EVE)));
  });

  it("denies an owner changing the uid", async () => {
    await seedCard(A, ALICE);
    await assertFails(setDoc(doc(as(ALICE), `flPets/${A}`), card(EVE)));
    await assertFails(
      updateDoc(doc(as(ALICE), `flPets/${A}`), {
        uid: EVE,
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("denies an update that adds a field or breaks a value", async () => {
    await seedCard(A, ALICE);
    await assertFails(
      setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE, { note: "hi" }))
    );
    await assertFails(
      setDoc(doc(as(ALICE), `flPets/${A}`), card(ALICE, { stage: "huge" }))
    );
  });

  it("denies a signed-out update", async () => {
    await seedCard(A, ALICE);
    await assertFails(setDoc(doc(signedOut(), `flPets/${A}`), card(ALICE)));
  });

  it("lets only the owner delete", async () => {
    await seedCard(A, ALICE);
    await assertFails(deleteDoc(doc(as(EVE), `flPets/${A}`)));
    await assertFails(deleteDoc(doc(signedOut(), `flPets/${A}`)));
    await assertSucceeds(deleteDoc(doc(as(ALICE), `flPets/${A}`)));
  });
});

describe("visits: create", () => {
  beforeEach(async () => {
    await seedCard(A, ALICE);
    await seedCard(B, BOB);
  });

  it("lets the owner of the visiting pet leave a visit", async () => {
    await assertSucceeds(setDoc(doc(as(BOB), visitPath(A, B)), visit(B)));
  });

  it("denies a signed-out visit", async () => {
    await assertFails(setDoc(doc(signedOut(), visitPath(A, B)), visit(B)));
  });

  it("denies a spoofed from (a card the visitor does not own)", async () => {
    await assertFails(setDoc(doc(as(EVE), visitPath(A, B)), visit(B)));
    await assertFails(setDoc(doc(as(ALICE), visitPath(A, B)), visit(B)));
  });

  it("denies a visit from a card that does not exist", async () => {
    await assertFails(setDoc(doc(as(EVE), visitPath(A, C)), visit(C)));
  });

  it("denies a visit to a card that does not exist", async () => {
    await assertFails(setDoc(doc(as(BOB), visitPath(C, B)), visit(B)));
  });

  it("denies a visit to yourself", async () => {
    await assertFails(setDoc(doc(as(ALICE), visitPath(A, A)), visit(A)));
  });

  it("allows a visit between two pets of the same owner", async () => {
    await seedCard(C, BOB);
    await assertSucceeds(setDoc(doc(as(BOB), visitPath(C, B)), visit(B)));
  });

  it("denies a day that is not today (UTC)", async () => {
    for (const day of [dayOffset(-1), dayOffset(1), "2020-01-01"]) {
      await assertFails(
        setDoc(doc(as(BOB), visitPath(A, B, day)), visit(B, { day }))
      );
    }
  });

  it("denies a malformed day", async () => {
    for (const day of ["today", "", "2026-1-1", 20261117]) {
      await assertFails(
        setDoc(
          doc(as(BOB), `flPets/${A}/visits/${B}_${day}`),
          visit(B, { day })
        )
      );
    }
  });

  it("denies a document id that is not from_day", async () => {
    await assertFails(
      setDoc(doc(as(BOB), `flPets/${A}/visits/anything`), visit(B))
    );
    await assertFails(
      setDoc(doc(as(BOB), `flPets/${A}/visits/${B}_${dayOffset(-1)}`), visit(B))
    );
    await assertFails(
      setDoc(doc(as(BOB), `flPets/${A}/visits/${B}`), visit(B))
    );
    await assertFails(
      setDoc(doc(as(BOB), `flPets/${A}/visits/${C}_${today()}`), visit(B))
    );
  });

  it("denies a second visit the same day", async () => {
    await assertSucceeds(setDoc(doc(as(BOB), visitPath(A, B)), visit(B)));
    await assertFails(setDoc(doc(as(BOB), visitPath(A, B)), visit(B)));
  });

  it("allows a visit to another friend the same day", async () => {
    await seedCard(C, EVE);
    await assertSucceeds(setDoc(doc(as(BOB), visitPath(A, B)), visit(B)));
    await assertSucceeds(setDoc(doc(as(BOB), visitPath(C, B)), visit(B)));
  });

  it("denies updating a visit", async () => {
    await seedVisit(A, B);
    await assertFails(
      updateDoc(doc(as(BOB), visitPath(A, B)), { createdAt: serverTimestamp() })
    );
    await assertFails(setDoc(doc(as(BOB), visitPath(A, B)), visit(B)));
  });

  it("denies extra, missing and wrongly typed fields", async () => {
    await assertFails(
      setDoc(doc(as(BOB), visitPath(A, B)), visit(B, { note: "hello" }))
    );
    for (const key of ["from", "day", "createdAt"]) {
      const data: Record<string, unknown> = visit(B);
      delete data[key];
      await assertFails(setDoc(doc(as(BOB), visitPath(A, B)), data));
    }
    await assertFails(
      setDoc(doc(as(BOB), visitPath(A, B)), visit(B, { from: 5 }))
    );
  });

  it("denies a createdAt that is not the server time", async () => {
    await assertFails(
      setDoc(
        doc(as(BOB), visitPath(A, B)),
        visit(B, { createdAt: new Date(Date.now() - 86_400_000) })
      )
    );
  });

  it("denies a visit written to a malformed target code", async () => {
    await assertFails(
      setDoc(doc(as(BOB), `flPets/abcdef/visits/${B}_${today()}`), visit(B))
    );
  });

  it("denies a visit written by an account that is not anonymous", async () => {
    await assertFails(setDoc(doc(emailUser(BOB), visitPath(A, B)), visit(B)));
  });
});

describe("visits: inbox", () => {
  beforeEach(async () => {
    await seedCard(A, ALICE);
    await seedCard(B, BOB);
    await seedVisit(A, B);
  });

  it("lets the owner get, list and delete their inbox", async () => {
    const db = as(ALICE);
    await assertSucceeds(getDoc(doc(db, visitPath(A, B))));
    const snap = await assertSucceeds(
      getDocs(collection(db, `flPets/${A}/visits`))
    );
    expect(snap.size).toBe(1);
    await assertSucceeds(deleteDoc(doc(db, visitPath(A, B))));
  });

  it("denies reading someone else's inbox", async () => {
    await assertFails(getDoc(doc(as(EVE), visitPath(A, B))));
    await assertFails(getDocs(collection(as(EVE), `flPets/${A}/visits`)));
    await assertFails(getDocs(collection(as(BOB), `flPets/${A}/visits`)));
  });

  it("denies a signed-out read", async () => {
    await assertFails(getDoc(doc(signedOut(), visitPath(A, B))));
    await assertFails(getDocs(collection(signedOut(), `flPets/${A}/visits`)));
  });

  it("denies deleting someone else's visit (even the sender's own)", async () => {
    await assertFails(deleteDoc(doc(as(EVE), visitPath(A, B))));
    await assertFails(deleteDoc(doc(as(BOB), visitPath(A, B))));
    await assertFails(deleteDoc(doc(signedOut(), visitPath(A, B))));
  });

  it("denies the owner of a deleted card reading old visits", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), `flPets/${A}`));
    });
    await assertFails(getDoc(doc(as(ALICE), visitPath(A, B))));
  });
});

describe("everything else stays closed", () => {
  it("denies other paths under a pet", async () => {
    await seedCard(A, ALICE);
    await assertFails(setDoc(doc(as(ALICE), `flPets/${A}/notes/x`), { a: 1 }));
    await assertFails(getDoc(doc(as(ALICE), `flPets/${A}/notes/x`)));
    await assertFails(setDoc(doc(as(ALICE), `flFriends/${A}`), { a: 1 }));
  });
});

describe("the REST client against the rules", () => {
  /** An unsigned token the emulator accepts as an anonymous player's. */
  function tokenFor(uid: string): string {
    const part = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${part({ alg: "none", typ: "JWT" })}.${part({
      user_id: uid,
      sub: uid,
      firebase: { sign_in_provider: "anonymous" },
    })}.`;
  }
  const deps = (uid: string) => ({
    config,
    baseUrl,
    getSession: async () => ({ uid, idToken: tokenFor(uid) }),
    getAppCheckHeaders: async () => ({}),
  });
  const pet: PetCard = {
    look: {
      colour: "sky",
      shape: "drop",
      eyes: "wide",
      hat: "crown",
      face: "none",
      neck: "scarf",
    },
    level: 7,
    stage: "flame",
    form: "none",
    nameId: 3,
  };

  it("creates, reads, updates a card and runs a playdate through the rules", async () => {
    expect(await createCard(A, pet, deps(ALICE))).toBe("ok");
    expect(await createCard(A, pet, deps(EVE))).not.toBe("ok");
    expect(await createCard(B, { ...pet, level: 2 }, deps(BOB))).toBe("ok");

    const found = await getCard(A, deps(BOB));
    expect(found).toEqual({ kind: "found", card: pet });
    expect((await getCard(C, deps(BOB))).kind).toBe("missing");

    // Too soon after the create.
    expect(await updateCard(A, { ...pet, level: 8 }, deps(ALICE))).toBe(
      "refused"
    );
    expect(await updateCard(A, pet, deps(EVE))).toBe("refused");

    expect(await createVisit(B, A, deps(BOB))).toBe("ok");
    expect(await createVisit(B, A, deps(BOB))).not.toBe("ok");
    expect(await createVisit(B, A, deps(EVE))).not.toBe("ok");
    expect(utcDay(Date.now())).toBe(today());

    expect(await listVisits(A, deps(BOB))).toBeNull();
    const inbox = await listVisits(A, deps(ALICE));
    expect(inbox).toEqual([{ id: `${B}_${today()}`, from: B }]);

    expect(await deleteVisit(A, `${B}_${today()}`, deps(BOB))).toBe(false);
    expect(await deleteVisit(A, `${B}_${today()}`, deps(ALICE))).toBe(true);
    expect(await listVisits(A, deps(ALICE))).toEqual([]);
  });

  it("updates a card once 10 seconds have passed", async () => {
    await seedCard(A, ALICE, 60_000);
    expect(await updateCard(A, { ...pet, level: 9 }, deps(ALICE))).toBe("ok");
    const found = await getCard(A, deps(ALICE));
    expect(found.kind === "found" && found.card.level).toBe(9);
  });
});

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
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  GAME_EVENTS,
  GAME_EVENT_NAMES,
  buildGameEvent,
  type GameEvent,
  type GameEventName,
  type PropSpec,
} from "@/lib/analytics/gameEvents";
import { newDocId, sendGameEvent } from "@/lib/analytics/gameSend";

const PROJECT_ID = "demo-gentryriggen";
const [HOST, PORT] = (
  process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080"
).split(":");
const ADMIN_UID = "nmt3n9sdfCX2NfzVlTdyXsWzHqm2";

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

const anon = () => env.unauthenticatedContext().firestore();
const admin = () =>
  env
    .authenticatedContext(ADMIN_UID, {
      email: "gentry.riggen@gmail.com",
      email_verified: true,
      firebase: { sign_in_provider: "password" },
    })
    .firestore();
const player = () =>
  env
    .authenticatedContext("some-kid", {
      firebase: { sign_in_provider: "anonymous" },
    })
    .firestore();

const today = () => new Date().toISOString().slice(0, 10);
/** The only createdAt the rules accept: the start of today (UTC). */
const midnight = () => new Date(`${today()}T00:00:00Z`);
const dayOffset = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

type Props = Record<string, string | number>;

/** A legal value for a prop spec, used to build a known-good event. */
function sampleValue(spec: PropSpec): string | number {
  switch (spec.kind) {
    case "enum":
      return spec.values[0];
    case "int":
      return spec.step ? spec.step * 2 : spec.min === -1 ? 0 : spec.min;
  }
}

function sampleProps(name: GameEventName): Props {
  const specs: Record<string, PropSpec> = GAME_EVENTS[name].props;
  return Object.fromEntries(
    Object.entries(specs).map(([key, spec]) => [key, sampleValue(spec)])
  );
}

function docFor(name: GameEventName, patch: Record<string, unknown> = {}) {
  return {
    site: GAME_EVENTS[name].site,
    name,
    props: sampleProps(name),
    day: today(),
    createdAt: midnight(),
    ...patch,
  };
}

function create(
  db: ReturnType<typeof anon>,
  data: Record<string, unknown>,
  id = newDocId()
) {
  return setDoc(doc(db, "gameEvents", id), data);
}

/** Creates a plane flight_end with `patch` merged into its props. */
function flightEnd(patch: Record<string, unknown>) {
  return docFor("flight_end", {
    props: { ...sampleProps("flight_end"), ...patch },
  });
}

describe("every event in the schema", () => {
  it.each(GAME_EVENT_NAMES)(
    "%s is accepted from a signed-out visitor",
    async (name) => {
      await assertSucceeds(create(anon(), docFor(name)));
    }
  );

  it("is also accepted from the real REST sender", async () => {
    for (const name of GAME_EVENT_NAMES) {
      const event = buildGameEvent(name, sampleProps(name) as never);
      expect(event).not.toBeNull();
      const ok = await sendGameEvent(event as GameEvent, { config, baseUrl });
      expect(ok).toBe(true);
    }
    const snap = await getDocs(collection(admin(), "gameEvents"));
    expect(snap.size).toBe(GAME_EVENT_NAMES.length);
  });

  it("accepts every enum value and the edges of every number", async () => {
    for (const name of GAME_EVENT_NAMES) {
      const specs: Record<string, PropSpec> = GAME_EVENTS[name].props;
      for (const [key, spec] of Object.entries(specs)) {
        const legal: (string | number)[] =
          spec.kind === "enum"
            ? [...spec.values]
            : spec.kind === "int"
              ? [spec.min, spec.max - (spec.step ? spec.max % spec.step : 0)]
              : [];
        for (const value of legal) {
          const props = { ...sampleProps(name), [key]: value };
          await assertSucceeds(create(anon(), docFor(name, { props })));
        }
      }
    }
  });

  it("accepts a storm trial in the wild sea and rejects unknown ones", async () => {
    const props = { kind: "storm", outcome: "sank", sea: "wild" };
    await assertSucceeds(create(anon(), docFor("trial_run", { props })));
    await assertFails(
      create(
        anon(),
        docFor("trial_run", { props: { ...props, kind: "tornado" } })
      )
    );
    await assertFails(
      create(
        anon(),
        docFor("trial_run", { props: { ...props, sea: "tsunami" } })
      )
    );
  });

  it("rejects values outside every prop's range", async () => {
    for (const name of GAME_EVENT_NAMES) {
      const specs: Record<string, PropSpec> = GAME_EVENTS[name].props;
      for (const [key, spec] of Object.entries(specs)) {
        const illegal: unknown[] =
          spec.kind === "enum"
            ? [
                "nope",
                "",
                spec.values[0].toUpperCase(),
                1,
                null,
                true,
                // Free text must never get through, even slug-shaped.
                "jane-doe-age-9-lives-on-elm-st",
                "titanic-2",
                `${spec.values[0]} `,
              ]
            : [
                spec.min - 1,
                spec.max + 1,
                "1",
                null,
                1.5,
                ...(spec.step ? [spec.step + 1] : []),
              ];
        for (const value of illegal) {
          const props = { ...sampleProps(name), [key]: value };
          await assertFails(create(anon(), docFor(name, { props })));
        }
      }
    }
  });

  it("rejects a missing prop, an extra prop, and an empty map", async () => {
    for (const name of GAME_EVENT_NAMES) {
      const props = sampleProps(name);
      await assertFails(
        create(anon(), docFor(name, { props: { ...props, note: "hi" } }))
      );
      await assertFails(
        create(anon(), docFor(name, { props: { ...props, userId: 7 } }))
      );
      const optional = (key: string) => {
        const spec: PropSpec | undefined = (
          GAME_EVENTS[name].props as Record<string, PropSpec>
        )[key];
        return spec?.kind === "enum" && spec.optional === true;
      };
      for (const key of Object.keys(props).filter((k) => !optional(k))) {
        const { [key]: _omitted, ...rest } = props;
        void _omitted;
        await assertFails(create(anon(), docFor(name, { props: rest })));
      }
    }
  });

  it("rejects props that belong to a different event", async () => {
    await assertFails(
      create(
        anon(),
        docFor("upgrade_bought", { props: sampleProps("world_unlocked") })
      )
    );
  });

  it("rejects every event on any other game's site", async () => {
    const sites = ["plane-builder", "ship-builder", "flamelings", "shipwreck"];
    for (const name of GAME_EVENT_NAMES) {
      for (const other of sites.filter((s) => s !== GAME_EVENTS[name].site)) {
        await assertFails(create(anon(), docFor(name, { site: other })));
      }
    }
  });
});

describe("the event envelope", () => {
  it("rejects an unknown event name or site", async () => {
    await assertFails(create(anon(), docFor("flight_end", { name: "login" })));
    await assertFails(create(anon(), docFor("flight_end", { name: 5 })));
    await assertFails(create(anon(), docFor("flight_end", { site: "home" })));
    await assertFails(create(anon(), docFor("flight_end", { site: "x" })));
  });

  it("rejects extra top-level fields (a user id, a session id, text)", async () => {
    for (const extra of ["uid", "vid", "sid", "note", "ua", "ip"]) {
      await assertFails(
        create(anon(), docFor("flight_end", { [extra]: "abc12345" }))
      );
    }
  });

  it("rejects a missing top-level field", async () => {
    for (const key of ["site", "name", "props", "day", "createdAt"]) {
      const data: Record<string, unknown> = docFor("flight_end");
      delete data[key];
      await assertFails(create(anon(), data));
    }
  });

  it("requires createdAt to be exactly the start of today (UTC)", async () => {
    const mid = midnight().getTime();
    await assertSucceeds(create(anon(), docFor("flight_end")));
    for (const createdAt of [
      new Date(mid + 1),
      new Date(mid + 3_600_000),
      new Date(Date.now()),
      new Date(mid - 86_400_000),
      new Date(0),
      "now",
      serverTimestamp(),
    ]) {
      await assertFails(create(anon(), docFor("flight_end", { createdAt })));
    }
  });

  it("accepts today's day and nothing else", async () => {
    await assertSucceeds(create(anon(), docFor("flight_end")));
    for (const day of [
      dayOffset(-1),
      dayOffset(1),
      "2020-01-01",
      "today",
      "",
      20260101,
      null,
    ]) {
      await assertFails(create(anon(), docFor("flight_end", { day })));
    }
  });

  it("rejects props that are not a map", async () => {
    await assertFails(create(anon(), docFor("ship_shared", { props: "x" })));
    await assertFails(create(anon(), docFor("ship_shared", { props: [] })));
    await assertFails(create(anon(), docFor("ship_shared", { props: null })));
  });

  it("accepts an empty props map for the prop-less events only", async () => {
    await assertSucceeds(create(anon(), docFor("ship_shared", { props: {} })));
    await assertSucceeds(create(anon(), docFor("fl_hatch", { props: {} })));
    await assertFails(create(anon(), docFor("flight_end", { props: {} })));
    await assertFails(create(anon(), docFor("fl_visit", { props: {} })));
  });

  it("accepts only UUIDv4-shaped document ids", async () => {
    const good = "3f2b8c1e-9a4d-4e7b-8c3a-1d5f6a7b8c9d";
    await assertSucceeds(create(anon(), docFor("flight_end"), good));
    for (const id of [
      "e1",
      "x".repeat(64),
      "3f2b8c1e-9a4d-1e7b-8c3a-1d5f6a7b8c9d", // not version 4
      "3f2b8c1e-9a4d-4e7b-0c3a-1d5f6a7b8c9d", // bad variant
      "3F2B8C1E-9A4D-4E7B-8C3A-1D5F6A7B8C9D", // upper case
      "3f2b8c1e9a4d4e7b8c3a1d5f6a7b8c9d", // no dashes
      "1793377924223-abcdef", // time-based fallback of old
      `${good}0`,
    ]) {
      await assertFails(create(anon(), docFor("flight_end"), id));
    }
  });

  it("makes ids from the real client fallback that pass", async () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    try {
      for (let i = 0; i < 20; i += 1) {
        await assertSucceeds(create(anon(), docFor("flight_end"), newDocId()));
      }
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: original,
        configurable: true,
      });
    }
  });

  it("rejects nested maps and arrays inside props", async () => {
    await assertFails(create(anon(), flightEnd({ world: { a: 1 } })));
    await assertFails(create(anon(), flightEnd({ world: ["meadow"] })));
    await assertFails(create(anon(), flightEnd({ dist: [1] })));
  });
});

describe("flamelings specifics", () => {
  it("takes the pet count of a full shelf and no more", async () => {
    const visit = (pets: number) =>
      docFor("fl_visit", { props: { window: "night", pets } });
    await assertSucceeds(create(anon(), visit(0)));
    await assertSucceeds(create(anon(), visit(8)));
    await assertFails(create(anon(), visit(9)));
  });

  it("only takes levels from 2 to 99 and a stage name", async () => {
    const level = (n: number, stage = "spark") =>
      docFor("fl_level", { props: { level: n, stage } });
    await assertSucceeds(create(anon(), level(2)));
    await assertSucceeds(create(anon(), level(99, "bonfire")));
    await assertFails(create(anon(), level(1)));
    await assertFails(create(anon(), level(100)));
    await assertFails(create(anon(), level(5, "Rex the Flame")));
  });

  it("takes a shop purchase as a kind and a price in tens up to 1000", async () => {
    const buy = (kind: string, price: number) =>
      docFor("fl_buy", { props: { kind, price } });
    await assertSucceeds(create(anon(), buy("hat", 30)));
    await assertSucceeds(create(anon(), buy("decor", 400)));
    await assertSucceeds(create(anon(), buy("neck", 1000)));
    await assertFails(create(anon(), buy("hat", 35)));
    await assertFails(create(anon(), buy("hat", 1010)));
    await assertFails(create(anon(), buy("hat", -10)));
    await assertFails(create(anon(), buy("emote", 30)));
    await assertFails(create(anon(), buy("pirate", 30)));
    await assertFails(
      create(anon(), docFor("fl_buy", { props: { kind: "hat" } }))
    );
    await assertFails(
      create(
        anon(),
        docFor("fl_buy", { props: { kind: "hat", price: 30, item: "pirate" } })
      )
    );
  });

  it("takes a happening as one of seven kinds and a started or done flag", async () => {
    const happening = (kind: string, done: number) =>
      docFor("fl_happening", { props: { kind, done } });
    for (const kind of [
      "visitor",
      "rain",
      "treasure",
      "star",
      "mushrooms",
      "hatchday",
      "season",
    ]) {
      await assertSucceeds(create(anon(), happening(kind, 0)));
      await assertSucceeds(create(anon(), happening(kind, 1)));
    }
    await assertFails(create(anon(), happening("owl", 1)));
    await assertFails(create(anon(), happening("visitor", 2)));
    await assertFails(create(anon(), happening("visitor", -1)));
    await assertFails(
      create(anon(), docFor("fl_happening", { props: { kind: "visitor" } }))
    );
    await assertFails(
      create(
        anon(),
        docFor("fl_happening", {
          props: { kind: "visitor", done: 1, who: "owl" },
        })
      )
    );
  });

  it("takes a mini-game round as one of three games and a score up to 99", async () => {
    const round = (game: string, score: number) =>
      docFor("fl_play_end", { props: { game, score } });
    for (const game of ["fireflies", "marshmallow", "logs"]) {
      await assertSucceeds(create(anon(), round(game, 0)));
      await assertSucceeds(create(anon(), round(game, 99)));
    }
    await assertFails(create(anon(), round("chess", 5)));
    await assertFails(create(anon(), round("logs", 100)));
    await assertFails(create(anon(), round("logs", -1)));
    // The old shape (a score alone) is no longer valid.
    await assertFails(
      create(anon(), docFor("fl_play_end", { props: { score: 5 } }))
    );
  });

  it("takes a grown-up form as one of three names and nothing else", async () => {
    for (const form of ["cozy", "wild", "sparkly"]) {
      await assertSucceeds(
        create(anon(), docFor("fl_form", { props: { form } }))
      );
    }
    await assertFails(
      create(anon(), docFor("fl_form", { props: { form: "Rex" } }))
    );
    await assertFails(create(anon(), docFor("fl_form", { props: {} })));
    await assertFails(
      create(
        anon(),
        docFor("fl_form", { props: { form: "cozy", name: "Sparky" } })
      )
    );
  });

  it("takes only the two ways a picture leaves, never a name or a file", async () => {
    for (const via of ["share", "download"]) {
      await assertSucceeds(
        create(anon(), docFor("fl_share", { props: { via } }))
      );
    }
    await assertFails(
      create(anon(), docFor("fl_share", { props: { via: "x" } }))
    );
    await assertFails(create(anon(), docFor("fl_share", { props: {} })));
    await assertFails(
      create(
        anon(),
        docFor("fl_share", { props: { via: "share", name: "Sparky" } })
      )
    );
  });

  it("never lets a typed name ride along", async () => {
    await assertFails(
      create(anon(), docFor("fl_hatch", { props: { name: "Sparky" } }))
    );
    await assertFails(
      create(anon(), docFor("fl_care", { props: { action: "Sparky" } }))
    );
  });
});

describe("flight_end specifics", () => {
  it("only takes crash positions on a 50 m bucket, or -1", async () => {
    await assertSucceeds(create(anon(), flightEnd({ crashX: 0 })));
    await assertSucceeds(create(anon(), flightEnd({ crashX: 4350 })));
    await assertSucceeds(create(anon(), flightEnd({ crashX: -1 })));
    await assertFails(create(anon(), flightEnd({ crashX: 4351 })));
    await assertFails(create(anon(), flightEnd({ crashX: -50 })));
    await assertFails(create(anon(), flightEnd({ crashX: 12050 })));
  });

  it("rejects a fractional number sent as a double", async () => {
    const fields = {
      site: { stringValue: "plane-builder" },
      name: { stringValue: "flight_end" },
      day: { stringValue: today() },
      props: {
        mapValue: {
          fields: {
            world: { stringValue: "meadow" },
            outcome: { stringValue: "crash" },
            dist: { doubleValue: 5 },
            crashX: { integerValue: "100" },
            obstacle: { stringValue: "tree" },
            tiers: { integerValue: "3" },
            daily: { integerValue: "0" },
          },
        },
      },
    };
    const send = (f: typeof fields) =>
      fetch(
        `${baseUrl}/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            writes: [
              {
                update: {
                  name: `projects/${PROJECT_ID}/databases/(default)/documents/gameEvents/${newDocId()}`,
                  fields: {
                    ...f,
                    createdAt: { timestampValue: `${today()}T00:00:00Z` },
                  },
                },
                currentDocument: { exists: false },
              },
            ],
          }),
        }
      );
    expect((await send(fields)).status).toBe(403);
    fields.props.mapValue.fields.dist = { integerValue: "5" } as never;
    expect((await send(fields)).status).toBe(200);
  });
});

describe("access", () => {
  async function seeded(): Promise<string> {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "gameEvents/seed"), {
        ...docFor("flight_end"),
        createdAt: new Date(),
      });
    });
    return "seed";
  }

  it("lets a signed-in anonymous player create too", async () => {
    await assertSucceeds(create(player(), docFor("flight_end")));
  });

  it("lets only the admin read", async () => {
    const id = await seeded();
    await assertSucceeds(getDoc(doc(admin(), "gameEvents", id)));
    await assertSucceeds(getDocs(collection(admin(), "gameEvents")));
    await assertFails(getDoc(doc(anon(), "gameEvents", id)));
    await assertFails(getDocs(collection(anon(), "gameEvents")));
    await assertFails(getDoc(doc(player(), "gameEvents", id)));
    await assertFails(getDocs(collection(player(), "gameEvents")));
  });

  it("never allows an update or delete, not even by the admin", async () => {
    const id = await seeded();
    for (const db of [anon(), player(), admin()]) {
      await assertFails(updateDoc(doc(db, "gameEvents", id), { day: today() }));
      await assertFails(
        setDoc(doc(db, "gameEvents", id), docFor("flight_end"))
      );
      await assertFails(deleteDoc(doc(db, "gameEvents", id)));
    }
  });

  it("does not let the admin write events that break the schema", async () => {
    await assertFails(
      create(admin(), docFor("flight_end", { note: "free text" }))
    );
  });

  it("closes sibling collections", async () => {
    await assertFails(
      setDoc(doc(anon(), "gameEventsExtra/x"), docFor("flight_end"))
    );
  });
});

describe("shipwreck specifics", () => {
  const start = (mode: string, opened: number) =>
    docFor("shipwreck_start", { props: { mode, opened } });
  const end = (props: Record<string, unknown>) =>
    docFor("shipwreck_end", {
      props: { ...sampleProps("shipwreck_end"), ...props },
    });

  it("takes a start with a mode and 0 to 16 openings", async () => {
    await assertSucceeds(create(anon(), start("real", 0)));
    await assertSucceeds(create(anon(), start("whatif", 16)));
    await assertFails(create(anon(), start("whatif", 17)));
    await assertFails(create(anon(), start("whatif", -1)));
    await assertFails(create(anon(), start("sandbox", 2)));
    await assertFails(
      create(anon(), docFor("shipwreck_start", { props: { mode: "real" } }))
    );
  });

  it("takes either ship on a start and an end, and an old client's event without one", async () => {
    for (const ship of ["titanic", "lusitania"]) {
      await assertSucceeds(
        create(
          anon(),
          docFor("shipwreck_start", {
            props: { mode: "whatif", opened: 3, ship },
          })
        )
      );
      await assertSucceeds(create(anon(), end({ ship })));
    }
    // Cached 1.0 clients send neither.
    await assertSucceeds(create(anon(), start("real", 0)));
    const { ship: _ship, ...old } = sampleProps("shipwreck_end");
    void _ship;
    await assertSucceeds(
      create(anon(), docFor("shipwreck_end", { props: old }))
    );
  });

  it("rejects an unknown, mistyped or doubled ship", async () => {
    for (const ship of [
      "britannic",
      "Titanic",
      "titanic ",
      "",
      1,
      null,
      true,
    ]) {
      await assertFails(
        create(
          anon(),
          docFor("shipwreck_start", {
            props: { mode: "real", opened: 0, ship },
          })
        )
      );
      await assertFails(create(anon(), end({ ship })));
    }
    // Still no extra keys beside it.
    await assertFails(
      create(
        anon(),
        docFor("shipwreck_start", {
          props: { mode: "real", opened: 0, ship: "titanic", note: "hi" },
        })
      )
    );
    await assertFails(create(anon(), end({ ship: "titanic", userId: 7 })));
    // A ship does not belong on the camera event.
    await assertFails(
      create(
        anon(),
        docFor("shipwreck_camera", {
          props: { camera: "orbit", ship: "titanic" },
        })
      )
    );
  });

  it("takes an end as a mode, a sank or floated outcome and 0 to 600 minutes", async () => {
    await assertSucceeds(create(anon(), end({ minutes: 0 })));
    await assertSucceeds(
      create(anon(), end({ outcome: "floated", minutes: 600 }))
    );
    await assertFails(create(anon(), end({ minutes: 601 })));
    await assertFails(create(anon(), end({ minutes: 1.5 })));
    await assertFails(create(anon(), end({ outcome: "broke-in-two" })));
    await assertFails(create(anon(), end({ mode: "x" })));
  });

  it("takes only a known camera", async () => {
    const camera = (value: unknown) =>
      docFor("shipwreck_camera", { props: { camera: value } });
    for (const name of [
      "orbit",
      "bridge",
      "stern",
      "lifeboat",
      "underwater",
      "cinematic",
    ]) {
      await assertSucceeds(create(anon(), camera(name)));
    }
    await assertFails(create(anon(), camera("selfie")));
    await assertFails(create(anon(), camera(3)));
  });
});

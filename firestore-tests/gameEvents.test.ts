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
import { sendGameEvent } from "@/lib/analytics/gameSend";

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
    case "slug":
      return "titanic";
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
    createdAt: serverTimestamp(),
    ...patch,
  };
}

let nextId = 0;
function create(
  db: ReturnType<typeof anon>,
  data: Record<string, unknown>,
  id = `e${(nextId += 1)}`
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
              : ["a", "a-1", "x".repeat(spec.maxLength)];
        for (const value of legal) {
          const props = { ...sampleProps(name), [key]: value };
          await assertSucceeds(create(anon(), docFor(name, { props })));
        }
      }
    }
  });

  it("rejects values outside every prop's range", async () => {
    for (const name of GAME_EVENT_NAMES) {
      const specs: Record<string, PropSpec> = GAME_EVENTS[name].props;
      for (const [key, spec] of Object.entries(specs)) {
        const illegal: unknown[] =
          spec.kind === "enum"
            ? ["nope", "", spec.values[0].toUpperCase(), 1, null, true]
            : spec.kind === "int"
              ? [
                  spec.min - 1,
                  spec.max + 1,
                  "1",
                  null,
                  1.5,
                  ...(spec.step ? [spec.step + 1] : []),
                ]
              : [
                  "",
                  "UPPER",
                  "has space",
                  "x".repeat(spec.maxLength + 1),
                  "a/b",
                  5,
                  null,
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
      for (const key of Object.keys(props)) {
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

  it("rejects a plane event on the ship site and the other way round", async () => {
    for (const name of GAME_EVENT_NAMES) {
      const other =
        GAME_EVENTS[name].site === "plane-builder"
          ? "ship-builder"
          : "plane-builder";
      await assertFails(create(anon(), docFor(name, { site: other })));
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

  it("requires createdAt to be the server time", async () => {
    await assertFails(
      create(anon(), docFor("flight_end", { createdAt: new Date() }))
    );
    await assertFails(
      create(anon(), docFor("flight_end", { createdAt: new Date(0) }))
    );
    await assertFails(
      create(anon(), docFor("flight_end", { createdAt: "now" }))
    );
  });

  it("accepts today and a day either side, nothing else", async () => {
    for (const day of [today(), dayOffset(-1), dayOffset(1)]) {
      await assertSucceeds(create(anon(), docFor("flight_end", { day })));
    }
    for (const day of [
      dayOffset(-2),
      dayOffset(2),
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

  it("accepts an empty props map for ship_shared only", async () => {
    await assertSucceeds(create(anon(), docFor("ship_shared", { props: {} })));
    await assertFails(create(anon(), docFor("flight_end", { props: {} })));
  });

  it("rejects a document id over 64 characters", async () => {
    await assertFails(create(anon(), docFor("flight_end"), "x".repeat(65)));
    await assertSucceeds(create(anon(), docFor("flight_end"), "x".repeat(64)));
  });

  it("rejects nested maps and arrays inside props", async () => {
    await assertFails(create(anon(), flightEnd({ world: { a: 1 } })));
    await assertFails(create(anon(), flightEnd({ world: ["meadow"] })));
    await assertFails(create(anon(), flightEnd({ dist: [1] })));
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
                  name: `projects/${PROJECT_ID}/databases/(default)/documents/gameEvents/d${Math.random().toString(36).slice(2)}`,
                  fields: f,
                },
                updateTransforms: [
                  { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
                ],
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

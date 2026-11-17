import type { PetCard } from "../../types";
import {
  createCard,
  createVisit,
  deleteVisit,
  getCard,
  listVisits,
  registerCard,
  updateCard,
  utcDay,
} from "../client";

const config = {
  apiKey: "KEY",
  authDomain: "x",
  projectId: "proj",
  appId: "x",
};
const card: PetCard = {
  look: {
    colour: "sky",
    shape: "drop",
    eyes: "wide",
    hat: "crown",
    face: "none",
    neck: "none",
  },
  level: 7,
  stage: "flame",
  form: "none",
  nameId: 3,
};

function reply(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function deps(fetchImpl: jest.Mock, extra = {}) {
  return {
    config,
    fetchImpl,
    getSession: async () => ({ uid: "me", idToken: "tok" }),
    getAppCheckHeaders: async () => ({ "X-Firebase-AppCheck": "ac" }),
    now: () => Date.UTC(2026, 10, 17, 12),
    ...extra,
  };
}

const wire = (call: unknown[]) =>
  JSON.parse((call[1] as { body: string }).body).writes[0];

describe("createCard and updateCard", () => {
  it("commits exactly the card fields with the uid, the server time and a precondition", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200));
    expect(await createCard("ABCDEF", card, deps(fetchImpl))).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("/documents:commit?key=KEY");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["X-Firebase-AppCheck"]).toBe("ac");
    const write = wire(fetchImpl.mock.calls[0]);
    expect(write.update.name).toBe(
      "projects/proj/databases/(default)/documents/flPets/ABCDEF"
    );
    expect(Object.keys(write.update.fields).sort()).toEqual(
      ["form", "level", "look", "nameId", "stage", "uid"].sort()
    );
    expect(write.update.fields.uid).toEqual({ stringValue: "me" });
    expect(write.update.fields.level).toEqual({ integerValue: "7" });
    expect(
      Object.keys(write.update.fields.look.mapValue.fields).sort()
    ).toEqual(["colour", "eyes", "face", "hat", "neck", "shape"]);
    expect(write.updateTransforms).toEqual([
      { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
      { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
    ]);
    expect(write.updateMask).toBeUndefined();
    expect(write.currentDocument).toEqual({ exists: false });
  });

  it("requires the card to exist for an update", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200));
    expect(await updateCard("ABCDEF", card, deps(fetchImpl))).toBe("ok");
    const write = wire(fetchImpl.mock.calls[0]);
    expect(write.currentDocument).toEqual({ exists: true });
    // createdAt stays as it was: it is neither masked in nor stamped again.
    expect(write.updateMask.fieldPaths.sort()).toEqual([
      "form",
      "level",
      "look",
      "nameId",
      "stage",
      "uid",
    ]);
    expect(write.updateTransforms).toEqual([
      { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
    ]);
  });

  it("tells a refusal, a conflict and an outage apart", async () => {
    const run = async (r: Response | Error) => {
      const fetchImpl = jest.fn();
      if (r instanceof Error) fetchImpl.mockRejectedValue(r);
      else fetchImpl.mockResolvedValue(r);
      return createCard("ABCDEF", card, deps(fetchImpl));
    };
    expect(await run(reply(403))).toBe("refused");
    expect(await run(reply(409, { error: { status: "ALREADY_EXISTS" } }))).toBe(
      "conflict"
    );
    expect(
      await run(reply(400, { error: { status: "FAILED_PRECONDITION" } }))
    ).toBe("conflict");
    expect(await run(reply(500))).toBe("error");
    expect(await run(new Error("offline"))).toBe("error");
  });

  it("never sends anything for a bad code, or when signed out or unconfigured", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200));
    expect(await createCard("abc", card, deps(fetchImpl))).toBe("error");
    expect(
      await createCard(
        "ABCDEF",
        card,
        deps(fetchImpl, { getSession: async () => null })
      )
    ).toBe("error");
    expect(
      await createCard(
        "ABCDEF",
        card,
        deps(fetchImpl, { config: { ...config, apiKey: "" } })
      )
    ).toBe("error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not throw when the session lookup throws", async () => {
    const fetchImpl = jest.fn();
    const throwing = async () => {
      throw new Error("boom");
    };
    expect(
      await updateCard(
        "ABCDEF",
        card,
        deps(fetchImpl, { getSession: throwing })
      )
    ).toBe("error");
  });
});

describe("registerCard", () => {
  it("retries a taken code with a new one", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(reply(403))
      .mockResolvedValueOnce(
        reply(409, { error: { status: "ALREADY_EXISTS" } })
      )
      .mockResolvedValueOnce(reply(200));
    const codes = ["AAAAAA", "BBBBBB", "CCCCCC"];
    let i = 0;
    const code = await registerCard(card, () => codes[i++], deps(fetchImpl));
    expect(code).toBe("CCCCCC");
  });

  it("stops at the first outage", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(503));
    const code = await registerCard(card, () => "AAAAAA", deps(fetchImpl));
    expect(code).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up after five taken codes", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(403));
    expect(
      await registerCard(card, () => "AAAAAA", deps(fetchImpl))
    ).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });
});

describe("getCard", () => {
  const doc = {
    fields: {
      uid: { stringValue: "them" },
      look: {
        mapValue: {
          fields: {
            colour: { stringValue: "sky" },
            shape: { stringValue: "drop" },
            eyes: { stringValue: "wide" },
            hat: { stringValue: "crown" },
            face: { stringValue: "none" },
            neck: { stringValue: "none" },
          },
        },
      },
      level: { integerValue: "7" },
      stage: { stringValue: "flame" },
      form: { stringValue: "none" },
      nameId: { integerValue: "3" },
    },
  };

  it("reads a card by code, with auth", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200, doc));
    expect(await getCard("ABCDEF", deps(fetchImpl))).toEqual({
      kind: "found",
      card,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("/documents/flPets/ABCDEF?key=KEY");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("says missing for a 404, a bad code or a card it cannot read", async () => {
    expect(
      await getCard("ABCDEF", deps(jest.fn().mockResolvedValue(reply(404))))
    ).toEqual({ kind: "missing" });
    expect(await getCard("nope", deps(jest.fn()))).toEqual({
      kind: "missing",
    });
    const odd = {
      fields: {
        ...doc.fields,
        stage: { stringValue: "mega" },
      },
    };
    expect(
      await getCard(
        "ABCDEF",
        deps(jest.fn().mockResolvedValue(reply(200, odd)))
      )
    ).toEqual({ kind: "missing" });
  });

  it("says error offline or on a server fault", async () => {
    expect(
      await getCard("ABCDEF", deps(jest.fn().mockRejectedValue(new Error("x"))))
    ).toEqual({ kind: "error" });
    expect(
      await getCard("ABCDEF", deps(jest.fn().mockResolvedValue(reply(500))))
    ).toEqual({ kind: "error" });
  });
});

describe("visits", () => {
  it("writes from, day and the server time to the friend's inbox, id from_day", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200));
    expect(await createVisit("AAAAAA", "BBBBBB", deps(fetchImpl))).toBe("ok");
    const write = wire(fetchImpl.mock.calls[0]);
    expect(write.update.name).toBe(
      "projects/proj/databases/(default)/documents/flPets/BBBBBB/visits/AAAAAA_2026-11-17"
    );
    expect(write.update.fields).toEqual({
      from: { stringValue: "AAAAAA" },
      day: { stringValue: "2026-11-17" },
    });
    expect(write.updateTransforms).toEqual([
      { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
    ]);
    expect(write.currentDocument).toEqual({ exists: false });
  });

  it("does not visit yourself or a bad code", async () => {
    const fetchImpl = jest.fn();
    expect(await createVisit("AAAAAA", "AAAAAA", deps(fetchImpl))).toBe(
      "error"
    );
    expect(await createVisit("AAAAAA", "x", deps(fetchImpl))).toBe("error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the UTC day", () => {
    expect(utcDay(Date.UTC(2026, 0, 1, 23, 59))).toBe("2026-01-01");
  });

  const CREATED = "2026-11-17T11:00:00Z";
  const own = reply(200, {
    fields: { createdAt: { timestampValue: CREATED } },
  });
  const row = (id: string, from: string, day: string) => ({
    document: {
      name: `projects/proj/databases/(default)/documents/flPets/ME/visits/${id}`,
      fields: { from: { stringValue: from }, day: { stringValue: day } },
    },
  });

  it("lists the inbox with a query that starts at the card's creation, keeping only well-formed visits", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(own)
      .mockResolvedValueOnce(
        reply(200, [
          row("AAAAAA_2026-11-17", "AAAAAA", "2026-11-17"),
          row("wrong-id", "BBBBBB", "2026-11-17"),
          row("bbbbbb_2026-11-17", "bbbbbb", "2026-11-17"),
          {},
        ])
      );
    expect(await listVisits("ABCDEF", deps(fetchImpl))).toEqual([
      { id: "AAAAAA_2026-11-17", from: "AAAAAA" },
    ]);
    expect(fetchImpl.mock.calls[1][0]).toContain(
      "/documents/flPets/ABCDEF:runQuery"
    );
    const query = JSON.parse(fetchImpl.mock.calls[1][1].body).structuredQuery;
    expect(query.from).toEqual([{ collectionId: "visits" }]);
    expect(query.where.fieldFilter).toEqual({
      field: { fieldPath: "createdAt" },
      op: "GREATER_THAN_OR_EQUAL",
      value: { timestampValue: CREATED },
    });
  });

  it("pages through a big inbox, up to the scan cap", async () => {
    const page = (n: number, offset: number) =>
      reply(
        200,
        Array.from({ length: n }, (_, i) =>
          row(`AAAAAA_2026-01-${String(offset + i)}`, "AAAAAA", "x")
        )
      );
    const calls: number[] = [];
    const fetchImpl = jest.fn(async (url: string, init?: RequestInit) => {
      if (!String(url).includes(":runQuery")) return own;
      const q = JSON.parse(init!.body as string).structuredQuery;
      calls.push(q.offset);
      return page(q.limit, q.offset);
    });
    await listVisits("ABCDEF", deps(fetchImpl as unknown as jest.Mock), 600);
    expect(calls).toEqual([0, 250, 500]);
  });

  it("stops paging at a short page", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(own)
      .mockResolvedValueOnce(reply(200, [{}]));
    expect(await listVisits("ABCDEF", deps(fetchImpl))).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("is null on failure or when the card has no createdAt", async () => {
    expect(
      await listVisits("ABCDEF", deps(jest.fn().mockResolvedValue(reply(403))))
    ).toBeNull();
    expect(
      await listVisits(
        "ABCDEF",
        deps(jest.fn().mockResolvedValue(reply(200, { fields: {} })))
      )
    ).toBeNull();
    expect(
      await listVisits(
        "ABCDEF",
        deps(jest.fn().mockRejectedValue(new Error("x")))
      )
    ).toBeNull();
  });

  it("deletes a visit by id and treats missing as gone", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200));
    expect(
      await deleteVisit("ABCDEF", "AAAAAA_2026-11-17", deps(fetchImpl))
    ).toBe(true);
    expect(fetchImpl.mock.calls[0][1].method).toBe("DELETE");
    expect(
      await deleteVisit(
        "ABCDEF",
        "AAAAAA_2026-11-17",
        deps(jest.fn().mockResolvedValue(reply(404)))
      )
    ).toBe(true);
    expect(
      await deleteVisit(
        "ABCDEF",
        "AAAAAA_2026-11-17",
        deps(jest.fn().mockResolvedValue(reply(403)))
      )
    ).toBe(false);
    expect(await deleteVisit("ABCDEF", "../x", deps(jest.fn()))).toBe(false);
  });
});

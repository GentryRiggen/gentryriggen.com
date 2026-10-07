import type { PageviewEvent } from "../types";
import { buildCommitBody, commitUrl, sendPageview } from "../send";

const event: PageviewEvent = {
  site: "home",
  path: "/",
  ref: "",
  device: "desktop",
  browser: "Chrome",
  os: "macOS",
  screen: "1440+",
  tz: "America/Denver",
  vid: "abcdef12-0000",
};

const config = {
  apiKey: "KEY",
  authDomain: "x.firebaseapp.com",
  projectId: "proj",
  appId: "1:2:web:3",
};

describe("buildCommitBody", () => {
  const body = buildCommitBody("proj", "doc1", event);
  const write = body.writes[0];

  it("targets a new pageviews doc", () => {
    expect(write.update.name).toBe(
      "projects/proj/databases/(default)/documents/pageviews/doc1"
    );
    expect(write.currentDocument).toEqual({ exists: false });
  });

  it("stores every field as a string value", () => {
    expect(write.update.fields.site).toEqual({ stringValue: "home" });
    expect(write.update.fields.tz).toEqual({ stringValue: "America/Denver" });
    expect(Object.keys(write.update.fields).sort()).toEqual([
      "browser",
      "device",
      "os",
      "path",
      "ref",
      "screen",
      "site",
      "tz",
      "vid",
    ]);
  });

  it("sets ts from the server request time", () => {
    expect(write.updateTransforms).toEqual([
      { fieldPath: "ts", setToServerValue: "REQUEST_TIME" },
    ]);
  });
});

describe("commitUrl", () => {
  it("uses the project and key", () => {
    expect(commitUrl(config)).toBe(
      "https://firestore.googleapis.com/v1/projects/proj/databases/(default)/documents:commit?key=KEY"
    );
  });
});

describe("sendPageview", () => {
  it("POSTs the commit body and reports success", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const ok = await sendPageview(event, { config, fetchImpl, docId: "d1" });
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(commitUrl(config));
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body).writes[0].update.name).toMatch(
      /pageviews\/d1$/
    );
  });

  it("does nothing when the config is empty", async () => {
    const fetchImpl = jest.fn();
    const ok = await sendPageview(event, {
      config: { ...config, apiKey: "" },
      fetchImpl,
    });
    expect(ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("swallows network errors", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("offline"));
    await expect(sendPageview(event, { config, fetchImpl })).resolves.toBe(
      false
    );
  });
});

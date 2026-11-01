import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import {
  faceIdAvailable,
  fromBase64Url,
  registerFaceId,
  toBase64Url,
  verifyFaceId,
  webAuthnUserId,
} from "@/lib/jim/faceId";

// jsdom has neither; the browser's are the same API.
Object.defineProperty(globalThis.crypto, "subtle", {
  value: webcrypto.subtle,
  configurable: true,
});
Object.assign(globalThis, { TextEncoder });

const ID = new Uint8Array([251, 255, 1, 2, 3, 62, 63]);
const create = jest.fn();
const get = jest.fn();

function withAuthenticator(available: boolean | "missing") {
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    value:
      available === "missing"
        ? undefined
        : {
            isUserVerifyingPlatformAuthenticatorAvailable: jest.fn(
              async () => available
            ),
          },
  });
}

beforeEach(() => {
  create.mockReset();
  get.mockReset();
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: { create, get },
  });
  withAuthenticator(true);
});

it("round-trips base64url", () => {
  const text = toBase64Url(ID);
  expect(text).not.toMatch(/[+/=]/);
  expect(fromBase64Url(text)).toEqual(ID);
  expect(fromBase64Url("not base64url!")).toBeNull();
});

it("is available only with a user-verifying platform authenticator", async () => {
  expect(await faceIdAvailable()).toBe(true);
  withAuthenticator(false);
  expect(await faceIdAvailable()).toBe(false);
  withAuthenticator("missing");
  expect(await faceIdAvailable()).toBe(false);
});

it("makes a platform credential that requires the user", async () => {
  create.mockResolvedValue({ type: "public-key", rawId: ID.buffer });
  expect(await registerFaceId("uid-1")).toBe(toBase64Url(ID));
  const { publicKey } = create.mock.calls[0][0] as CredentialCreationOptions;
  expect(publicKey?.excludeCredentials).toEqual([]);
  expect(publicKey?.rp.id).toBe(window.location.hostname);
  expect(publicKey?.authenticatorSelection).toEqual({
    authenticatorAttachment: "platform",
    userVerification: "required",
    residentKey: "discouraged",
  });
  expect((publicKey?.challenge as Uint8Array).length).toBe(32);
  // The same user id every time for this uid, and not the uid itself.
  const userId = publicKey?.user.id as Uint8Array;
  expect(userId).toEqual(await webAuthnUserId("uid-1"));
  expect(userId).not.toEqual(await webAuthnUserId("uid-2"));
  expect(userId).toHaveLength(32);
});

it("won't make a second credential where one exists", async () => {
  create.mockResolvedValue({ type: "public-key", rawId: ID.buffer });
  await registerFaceId("uid-1", toBase64Url(ID));
  const { publicKey } = create.mock.calls[0][0] as CredentialCreationOptions;
  expect(publicKey?.excludeCredentials).toEqual([
    { type: "public-key", id: ID, transports: ["internal"] },
  ]);
});

it("returns null when setup is cancelled", async () => {
  create.mockRejectedValue(new DOMException("no", "NotAllowedError"));
  expect(await registerFaceId("uid-1")).toBeNull();
  create.mockResolvedValue(null);
  expect(await registerFaceId("uid-1")).toBeNull();
});

it("unlocks only for an assertion of the stored credential", async () => {
  get.mockResolvedValue({ type: "public-key", rawId: ID.buffer });
  expect(await verifyFaceId(toBase64Url(ID))).toBe(true);
  const { publicKey } = get.mock.calls[0][0] as CredentialRequestOptions;
  expect(publicKey?.userVerification).toBe("required");
  expect(publicKey?.allowCredentials).toEqual([
    { type: "public-key", id: ID, transports: ["internal"] },
  ]);
  // A fresh challenge each time.
  await verifyFaceId(toBase64Url(ID));
  const second = (get.mock.calls[1][0] as CredentialRequestOptions).publicKey;
  expect(second?.challenge).not.toEqual(publicKey?.challenge);

  get.mockResolvedValue({
    type: "public-key",
    rawId: new Uint8Array([9, 9]).buffer,
  });
  expect(await verifyFaceId(toBase64Url(ID))).toBe(false);
});

it("treats a cancel or an error as no", async () => {
  get.mockRejectedValue(new DOMException("cancel", "NotAllowedError"));
  expect(await verifyFaceId(toBase64Url(ID))).toBe(false);
  get.mockResolvedValue(null);
  expect(await verifyFaceId(toBase64Url(ID))).toBe(false);
  expect(await verifyFaceId("")).toBe(false);
});

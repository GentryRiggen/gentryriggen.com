/**
 * Face ID (or Touch ID, Windows Hello) for the app lock, through WebAuthn's
 * platform authenticator. Local only: there is no server to verify the
 * signature, so a successful, user-verified assertion for the credential made
 * here is what unlocks. The PIN stays the fallback and guards the settings.
 */

import { fromBase64, toBase64 } from "@/lib/jim/appLock";

const WAIT_MS = 60_000;

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const plain = text.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(plain + "=".repeat((4 - (plain.length % 4)) % 4));
}

function randomBytes(size: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(size));
}

function rawIdOf(credential: Credential | null): Uint8Array | null {
  if (!credential || credential.type !== "public-key") return null;
  const rawId: unknown = (credential as PublicKeyCredential).rawId;
  if (rawId instanceof ArrayBuffer) return new Uint8Array(rawId);
  if (ArrayBuffer.isView(rawId)) {
    return new Uint8Array(rawId.buffer, rawId.byteOffset, rawId.byteLength);
  }
  return null;
}

/** This device can verify its owner (Face ID and the like) for this page. */
export async function faceIdAvailable(): Promise<boolean> {
  try {
    const pkc = window.PublicKeyCredential;
    if (
      typeof pkc?.isUserVerifyingPlatformAuthenticatorAvailable !==
        "function" ||
      typeof navigator.credentials?.create !== "function" ||
      typeof navigator.credentials?.get !== "function"
    ) {
      return false;
    }
    return await pkc.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Makes a platform credential (Face ID asks). Returns its id, base64url, or
 * null when it was cancelled or failed.
 */
export async function registerFaceId(): Promise<string | null> {
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { id: window.location.hostname, name: "Jim" },
        user: { id: randomBytes(16), name: "Jim", displayName: "Jim" },
        challenge: randomBytes(32),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "discouraged",
        },
        attestation: "none",
        timeout: WAIT_MS,
      },
    });
    const id = rawIdOf(credential);
    return id && id.length > 0 ? toBase64Url(id) : null;
  } catch {
    return null;
  }
}

/**
 * Asks for Face ID against the stored credential. True only for an assertion
 * of that very credential; a cancel, a timeout or any error is false.
 */
export async function verifyFaceId(credentialId: string): Promise<boolean> {
  const id = fromBase64Url(credentialId);
  if (!id || id.length === 0) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: window.location.hostname,
        allowCredentials: [{ type: "public-key", id }],
        userVerification: "required",
        timeout: WAIT_MS,
      },
    });
    const got = rawIdOf(assertion);
    if (!got || got.length !== id.length) return false;
    return got.every((byte, i) => byte === id[i]);
  } catch {
    return false;
  }
}

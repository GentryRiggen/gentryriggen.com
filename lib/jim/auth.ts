import type { Auth, User } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase/config";
import { signInWithCode, type SignInResult } from "@/lib/firebase/mfa";

/**
 * Jim's own Firebase sign-in. It never shares the rest of the site's app:
 * its own named app, its own sign-in tenant (so a session from another page
 * can't be used here), no App Check (no third-party script on Jim's page) and
 * no popup/redirect helper (no authDomain iframe). Sessions persist in
 * IndexedDB, so the code from an authenticator is asked only on a new device.
 */

export type { SignInResult } from "@/lib/firebase/mfa";

export interface AuthUser {
  uid: string;
  email: string | null;
}

/** The error code when this build has no Jim tenant id. */
export const TENANT_MISSING = "jim/tenant-missing";

/** The authenticator-app factor id (TotpMultiFactorGenerator.FACTOR_ID). */
const TOTP = "totp";

/** Shown in the authenticator app next to the account. */
const ISSUER = "Jim";

/** The name the enrolled factor gets. */
const FACTOR_NAME = "Authenticator";

/**
 * Jim's sign-in tenant id, set at build time (public, like the rest of the
 * Firebase web config). Written out in full so the build inlines it.
 */
function jimTenant(): string {
  return process.env.NEXT_PUBLIC_JIM_TENANT ?? "";
}

export function isJimAuthConfigured(): boolean {
  return jimTenant() !== "";
}

function authError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

type AuthModule = typeof import("firebase/auth");

let authPromise: Promise<{ mod: AuthModule; auth: Auth }> | null = null;

function jimAuth(): Promise<{ mod: AuthModule; auth: Auth }> {
  authPromise ??= Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
  ]).then(([appMod, mod]) => {
    const app =
      appMod.getApps().find((a) => a.name === "jim") ??
      appMod.initializeApp(firebaseConfig, "jim");
    const auth = mod.initializeAuth(app, {
      persistence: [mod.indexedDBLocalPersistence],
    });
    const tenant = jimTenant();
    if (tenant) auth.tenantId = tenant;
    return { mod, auth };
  });
  return authPromise;
}

/** Only a user of Jim's tenant counts; nobody counts without a tenant. */
function isJimUser(user: User | null): user is User {
  const tenant = jimTenant();
  return user !== null && tenant !== "" && user.tenantId === tenant;
}

/** Subscribes to auth changes; resolves to the unsubscribe function. */
export async function watchAuth(
  onChange: (user: AuthUser | null) => void
): Promise<() => void> {
  const { mod, auth } = await jimAuth();
  return mod.onAuthStateChanged(auth, (user) =>
    onChange(isJimUser(user) ? { uid: user.uid, email: user.email } : null)
  );
}

/**
 * Signs in with the password. When the account has an authenticator, the
 * result asks for its code (see SignInResult). Rejects with TENANT_MISSING
 * when this build doesn't know Jim's tenant.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<SignInResult> {
  if (!isJimAuthConfigured()) {
    throw authError(
      TENANT_MISSING,
      "Jim's sign-in isn't set up in this build."
    );
  }
  const { mod, auth } = await jimAuth();
  return signInWithCode(mod, auth, email, password);
}

export async function signOutUser(): Promise<void> {
  const { mod, auth } = await jimAuth();
  await mod.signOut(auth);
}

async function currentUser(): Promise<User | null> {
  const { auth } = await jimAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  return isJimUser(user) ? user : null;
}

/** The signed-in account's email, or null. */
export async function accountEmail(): Promise<string | null> {
  const user = await currentUser();
  return user?.email ?? null;
}

/**
 * The signed-in user's Firebase ID token (for Jim's server), or null when
 * nobody is signed in. `force` skips the cached token, e.g. after a 401.
 */
export async function getIdToken(force = false): Promise<string | null> {
  const user = await currentUser();
  return user ? user.getIdToken(force) : null;
}

/**
 * Whether an authenticator is enrolled, and whether this session's sign-in
 * used it.
 */
export async function secondFactor(): Promise<{
  enrolled: boolean;
  thisSession: boolean;
}> {
  const user = await currentUser();
  if (!user) return { enrolled: false, thisSession: false };
  const { mod } = await jimAuth();
  const enrolled = mod
    .multiFactor(user)
    .enrolledFactors.some((f) => f.factorId === TOTP);
  const result = await user.getIdTokenResult();
  const firebaseClaim = result.claims.firebase as
    { sign_in_second_factor?: unknown } | undefined;
  const used =
    result.signInSecondFactor ?? firebaseClaim?.sign_in_second_factor;
  return { enrolled, thisSession: used === TOTP };
}

/**
 * Starts enrolling an authenticator app: checks the password again, then
 * makes a secret. `url` is the otpauth:// link for a QR code; `finish` takes
 * the app's first code and enrolls it (it may be called again after a
 * wrong code).
 */
export async function startTotp(password: string): Promise<{
  secret: string;
  url: string;
  finish: (code: string) => Promise<void>;
}> {
  const user = await currentUser();
  if (!user || !user.email) {
    throw authError("auth/no-current-user", "Nobody is signed in.");
  }
  const { mod } = await jimAuth();
  await mod.reauthenticateWithCredential(
    user,
    mod.EmailAuthProvider.credential(user.email, password)
  );
  const session = await mod.multiFactor(user).getSession();
  const secret = await mod.TotpMultiFactorGenerator.generateSecret(session);
  return {
    secret: secret.secretKey,
    url: secret.generateQrCodeUrl(user.email, ISSUER),
    finish: async (code: string) => {
      const assertion = mod.TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        code
      );
      await mod.multiFactor(user).enroll(assertion, FACTOR_NAME);
    },
  };
}

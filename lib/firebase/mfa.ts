import type { Auth, MultiFactorError } from "firebase/auth";

/** The firebase/auth pieces sign-in needs (the module, loaded on demand). */
export type AuthModule = Pick<
  typeof import("firebase/auth"),
  | "signInWithEmailAndPassword"
  | "getMultiFactorResolver"
  | "TotpMultiFactorGenerator"
>;

/**
 * A password sign-in either finished, or needs the 6-digit code from an
 * authenticator app. `finish` can be called again after a wrong code
 * (it rejects with `auth/invalid-verification-code`).
 */
export type SignInResult =
  { kind: "done" } | { kind: "code"; finish: (code: string) => Promise<void> };

/** The authenticator-app factor id (TotpMultiFactorGenerator.FACTOR_ID). */
const TOTP = "totp";

function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) return;
  const { code } = err as { code: unknown };
  return typeof code === "string" ? code : undefined;
}

export async function signInWithCode(
  mod: AuthModule,
  auth: Auth,
  email: string,
  password: string
): Promise<SignInResult> {
  try {
    await mod.signInWithEmailAndPassword(auth, email, password);
    return { kind: "done" };
  } catch (err) {
    if (errorCode(err) !== "auth/multi-factor-auth-required") throw err;
    const resolver = mod.getMultiFactorResolver(auth, err as MultiFactorError);
    const hint = resolver.hints.find((h) => h.factorId === TOTP);
    // Only authenticator-app codes are supported; anything else fails sign-in.
    if (!hint) throw err;
    return {
      kind: "code",
      finish: async (code: string) => {
        const assertion = mod.TotpMultiFactorGenerator.assertionForSignIn(
          hint.uid,
          code
        );
        await resolver.resolveSignIn(assertion);
      },
    };
  }
}

/** Said when the authenticator code was wrong (or already used). */
export const WRONG_CODE = "That code didn't work. Try the newest one.";

/** Said when the code step failed some other way (e.g. it took too long). */
export const CODE_RESTART = "That didn't work. Sign in again.";

/** True when `finish` failed only because the code was wrong. */
export function isWrongCode(err: unknown): boolean {
  return errorCode(err) === "auth/invalid-verification-code";
}

import { signInWithCode } from "../mfa";

type Mod = Parameters<typeof signInWithCode>[0];
type Auth = Parameters<typeof signInWithCode>[1];

const auth = { name: "test-auth" } as unknown as Auth;

function authError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function makeMod(signIn: jest.Mock) {
  const resolver = {
    hints: [
      { uid: "phone-hint", factorId: "phone" },
      { uid: "totp-hint", factorId: "totp" },
    ],
    resolveSignIn: jest.fn(async () => ({})),
  };
  const mod = {
    signInWithEmailAndPassword: signIn,
    getMultiFactorResolver: jest.fn(() => resolver),
    TotpMultiFactorGenerator: {
      FACTOR_ID: "totp",
      assertionForSignIn: jest.fn((uid: string, code: string) => ({
        uid,
        code,
      })),
    },
  };
  return { mod: mod as unknown as Mod, raw: mod, resolver };
}

it("is done when the password alone signs in", async () => {
  const { mod } = makeMod(jest.fn(async () => ({})));
  await expect(signInWithCode(mod, auth, "a@b.test", "pw")).resolves.toEqual({
    kind: "done",
  });
});

it("asks for a code when a second factor is required, and finishes with it", async () => {
  const required = authError("auth/multi-factor-auth-required");
  const { mod, raw, resolver } = makeMod(
    jest.fn(async () => {
      throw required;
    })
  );
  const result = await signInWithCode(mod, auth, "a@b.test", "pw");
  expect(result.kind).toBe("code");
  expect(raw.getMultiFactorResolver).toHaveBeenCalledWith(auth, required);
  if (result.kind !== "code") throw new Error("expected a code step");
  await result.finish("123456");
  expect(raw.TotpMultiFactorGenerator.assertionForSignIn).toHaveBeenCalledWith(
    "totp-hint",
    "123456"
  );
  expect(resolver.resolveSignIn).toHaveBeenCalledWith({
    uid: "totp-hint",
    code: "123456",
  });
});

it("lets a wrong code be retried", async () => {
  const { mod, resolver } = makeMod(
    jest.fn(async () => {
      throw authError("auth/multi-factor-auth-required");
    })
  );
  resolver.resolveSignIn
    .mockRejectedValueOnce(authError("auth/invalid-verification-code"))
    .mockResolvedValueOnce({});
  const result = await signInWithCode(mod, auth, "a@b.test", "pw");
  if (result.kind !== "code") throw new Error("expected a code step");
  await expect(result.finish("000000")).rejects.toMatchObject({
    code: "auth/invalid-verification-code",
  });
  await expect(result.finish("654321")).resolves.toBeUndefined();
  expect(resolver.resolveSignIn).toHaveBeenCalledTimes(2);
});

it("rethrows any other sign-in error", async () => {
  const wrong = authError("auth/invalid-credential");
  const { mod, raw } = makeMod(
    jest.fn(async () => {
      throw wrong;
    })
  );
  await expect(signInWithCode(mod, auth, "a@b.test", "pw")).rejects.toBe(wrong);
  expect(raw.getMultiFactorResolver).not.toHaveBeenCalled();
});

it("rethrows when no authenticator-app factor is enrolled", async () => {
  const required = authError("auth/multi-factor-auth-required");
  const { mod, resolver } = makeMod(
    jest.fn(async () => {
      throw required;
    })
  );
  resolver.hints = [{ uid: "phone-hint", factorId: "phone" }];
  await expect(signInWithCode(mod, auth, "a@b.test", "pw")).rejects.toBe(
    required
  );
});

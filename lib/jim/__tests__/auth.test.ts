/**
 * Jim's own Firebase sign-in: its own app and tenant, no App Check, and no
 * popup/redirect helper (so no authDomain iframe).
 */

export {};

const mockInitializeAppCheck = jest.fn();
jest.mock("firebase/app-check", () => ({
  initializeAppCheck: mockInitializeAppCheck,
  ReCaptchaEnterpriseProvider: jest.fn(),
}));

const mockApp = { name: "jim" };
const mockInitializeApp = jest.fn<typeof mockApp, [unknown, string?]>(
  () => mockApp
);
jest.mock("firebase/app", () => ({
  getApps: () => [],
  initializeApp: (config: unknown, name?: string) =>
    mockInitializeApp(config, name),
}));

type Listener = (user: unknown) => void;
interface FakeUser {
  uid: string;
  email: string | null;
  tenantId: string | null;
  getIdToken: jest.Mock;
  getIdTokenResult: jest.Mock;
}
const mockAuth: {
  tenantId: string | null;
  currentUser: FakeUser | null;
  authStateReady: jest.Mock;
} = {
  tenantId: null,
  currentUser: null,
  authStateReady: jest.fn(async () => {}),
};
const mockEnrolled: { factorId: string }[] = [];
const mockEnroll = jest.fn(async () => {});
const mockSecret = {
  secretKey: "SECRETKEY",
  generateQrCodeUrl: jest.fn(
    (account: string, issuer: string) => `otpauth://${issuer}/${account}`
  ),
};
let mockListener: Listener = () => {};
const mockAuthMod = {
  initializeAuth: jest.fn(() => mockAuth),
  indexedDBLocalPersistence: { type: "INDEXED_DB" },
  onAuthStateChanged: jest.fn((_auth: unknown, cb: Listener) => {
    mockListener = cb;
    return () => {};
  }),
  signInWithEmailAndPassword: jest.fn(async () => ({})),
  getMultiFactorResolver: jest.fn(),
  signOut: jest.fn(async () => {}),
  EmailAuthProvider: {
    credential: jest.fn((email: string, password: string) => ({
      email,
      password,
    })),
  },
  reauthenticateWithCredential: jest.fn(async () => ({})),
  multiFactor: jest.fn(() => ({
    enrolledFactors: mockEnrolled,
    getSession: jest.fn(async () => "mfa-session"),
    enroll: mockEnroll,
  })),
  TotpMultiFactorGenerator: {
    FACTOR_ID: "totp",
    generateSecret: jest.fn(async () => mockSecret),
    assertionForEnrollment: jest.fn((secret: unknown, code: string) => ({
      secret,
      code,
    })),
    assertionForSignIn: jest.fn(),
  },
};
jest.mock("firebase/auth", () => mockAuthMod);

const TENANT = "jim-tenant-test";

function fakeUser(over: Partial<FakeUser> = {}): FakeUser {
  return {
    uid: "owner-uid",
    email: "owner@example.test",
    tenantId: TENANT,
    getIdToken: jest.fn(async (force?: boolean) =>
      force ? "fresh" : "cached"
    ),
    getIdTokenResult: jest.fn(async () => ({
      signInSecondFactor: null,
      claims: {},
    })),
    ...over,
  };
}

type AuthLib = typeof import("../auth");
let lib: AuthLib;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  process.env.NEXT_PUBLIC_JIM_TENANT = TENANT;
  mockAuth.tenantId = null;
  mockAuth.currentUser = null;
  mockEnrolled.length = 0;
  lib = jest.requireActual<AuthLib>("../auth");
});

afterAll(() => {
  delete process.env.NEXT_PUBLIC_JIM_TENANT;
});

it("starts its own app and auth without App Check or a popup helper", async () => {
  const seen: unknown[] = [];
  await lib.watchAuth((u) => seen.push(u));
  expect(mockInitializeApp).toHaveBeenCalledTimes(1);
  expect(mockInitializeApp.mock.calls[0][1]).toBe("jim");
  expect(mockAuthMod.initializeAuth).toHaveBeenCalledWith(mockApp, {
    persistence: [mockAuthMod.indexedDBLocalPersistence],
  });
  const options = (
    mockAuthMod.initializeAuth.mock.calls[0] as unknown[]
  )[1] as Record<string, unknown>;
  expect(options).not.toHaveProperty("popupRedirectResolver");
  expect(mockAuth.tenantId).toBe(TENANT);
  expect(mockInitializeAppCheck).not.toHaveBeenCalled();
});

it("starts the app once however many calls come in", async () => {
  await Promise.all([lib.watchAuth(() => {}), lib.getIdToken()]);
  await lib.signOutUser();
  expect(mockInitializeApp).toHaveBeenCalledTimes(1);
  expect(mockAuthMod.initializeAuth).toHaveBeenCalledTimes(1);
});

it("reports the tenant's user and nobody from another pool", async () => {
  const seen: unknown[] = [];
  await lib.watchAuth((u) => seen.push(u));
  mockListener(fakeUser());
  mockListener(fakeUser({ tenantId: null }));
  mockListener(null);
  expect(seen).toEqual([
    { uid: "owner-uid", email: "owner@example.test" },
    null,
    null,
  ]);
});

it("signs in with the password and passes the code step through", async () => {
  await expect(lib.signInWithEmail("a@b.test", "pw")).resolves.toEqual({
    kind: "done",
  });
  expect(mockAuthMod.signInWithEmailAndPassword).toHaveBeenCalledWith(
    mockAuth,
    "a@b.test",
    "pw"
  );
});

it("refuses to sign in, clearly, when the build has no tenant", async () => {
  process.env.NEXT_PUBLIC_JIM_TENANT = "";
  jest.resetModules();
  lib = jest.requireActual<AuthLib>("../auth");
  await expect(lib.signInWithEmail("a@b.test", "pw")).rejects.toMatchObject({
    code: lib.TENANT_MISSING,
  });
  expect(mockAuthMod.signInWithEmailAndPassword).not.toHaveBeenCalled();
  expect(lib.isJimAuthConfigured()).toBe(false);
  // Nothing signed in to another pool is ever reported.
  const seen: unknown[] = [];
  await lib.watchAuth((u) => seen.push(u));
  mockListener(fakeUser({ tenantId: null }));
  expect(seen).toEqual([null]);
});

it("gives the tenant user's token, forcing a refresh when asked", async () => {
  await expect(lib.getIdToken()).resolves.toBeNull();
  mockAuth.currentUser = fakeUser();
  await expect(lib.getIdToken()).resolves.toBe("cached");
  await expect(lib.getIdToken(true)).resolves.toBe("fresh");
  expect(mockAuth.authStateReady).toHaveBeenCalled();
  mockAuth.currentUser = fakeUser({ tenantId: "other" });
  await expect(lib.getIdToken()).resolves.toBeNull();
});

it("says whether a second factor is enrolled and used this session", async () => {
  await expect(lib.secondFactor()).resolves.toEqual({
    enrolled: false,
    thisSession: false,
  });
  const user = fakeUser();
  mockAuth.currentUser = user;
  mockEnrolled.push({ factorId: "totp" });
  user.getIdTokenResult.mockResolvedValue({
    signInSecondFactor: "totp",
    claims: { firebase: { sign_in_second_factor: "totp" } },
  });
  await expect(lib.secondFactor()).resolves.toEqual({
    enrolled: true,
    thisSession: true,
  });
});

it("enrolls an authenticator after checking the password again", async () => {
  mockAuth.currentUser = fakeUser();
  const started = await lib.startTotp("pw");
  expect(mockAuthMod.EmailAuthProvider.credential).toHaveBeenCalledWith(
    "owner@example.test",
    "pw"
  );
  expect(mockAuthMod.reauthenticateWithCredential).toHaveBeenCalled();
  expect(
    mockAuthMod.TotpMultiFactorGenerator.generateSecret
  ).toHaveBeenCalledWith("mfa-session");
  expect(started.secret).toBe("SECRETKEY");
  expect(started.url).toBe("otpauth://Jim/owner@example.test");
  await started.finish("123456");
  expect(
    mockAuthMod.TotpMultiFactorGenerator.assertionForEnrollment
  ).toHaveBeenCalledWith(mockSecret, "123456");
  expect(mockEnroll).toHaveBeenCalledWith(
    { secret: mockSecret, code: "123456" },
    "Authenticator"
  );
});

it("won't start enrolling with nobody signed in", async () => {
  await expect(lib.startTotp("pw")).rejects.toThrow();
  expect(mockAuthMod.reauthenticateWithCredential).not.toHaveBeenCalled();
});

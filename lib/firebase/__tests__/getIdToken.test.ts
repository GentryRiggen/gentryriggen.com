import { getIdToken } from "../client";

const mockAuth: {
  currentUser: { getIdToken: jest.Mock } | null;
  authStateReady: jest.Mock;
} = { currentUser: null, authStateReady: jest.fn(async () => {}) };

jest.mock("firebase/app", () => ({
  getApps: () => [{}],
  initializeApp: () => ({}),
}));

jest.mock("firebase/auth", () => ({ getAuth: () => mockAuth }));

it("is null when nobody is signed in", async () => {
  mockAuth.currentUser = null;
  await expect(getIdToken()).resolves.toBeNull();
  expect(mockAuth.authStateReady).toHaveBeenCalled();
});

it("returns the user's token, forcing a refresh when asked", async () => {
  const token = jest.fn(async (force: boolean) => (force ? "fresh" : "cached"));
  mockAuth.currentUser = { getIdToken: token };
  await expect(getIdToken()).resolves.toBe("cached");
  await expect(getIdToken(true)).resolves.toBe("fresh");
  expect(token.mock.calls).toEqual([[false], [true]]);
});

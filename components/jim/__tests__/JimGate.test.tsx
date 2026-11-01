import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as admin from "@/lib/analytics/admin";
import { ADMIN_UID } from "@/lib/analytics/admin";
import * as client from "@/lib/firebase/client";
import * as config from "@/lib/firebase/config";
import * as api from "@/lib/jim/api";
import * as host from "@/lib/jim/host";
import { historyKey, loadHistory, saveHistory } from "@/lib/jim/history";
import { isWipePending, lockKey, markWipePending } from "@/lib/jim/appLock";
import * as view from "@/lib/jim/view";
import * as money from "@/lib/jim/money";
import * as offline from "@/lib/jim/offlineStore";
import * as push from "@/lib/jim/push";
import { fetchView, getCachedView } from "@/lib/jim/view";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import JimGate from "../JimGate";

jest.mock("@/lib/firebase/client");
jest.mock("@/lib/firebase/config");
// The real URL by default; a test sets it to "" for the not-connected state.
let mockApi: string | undefined;
jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return {
    ...actual,
    wakeJim: jest.fn(),
    get JIM_API() {
      return mockApi ?? actual.JIM_API;
    },
  };
});
// The early prefetch is watched, not run; the cache itself is real.
jest.mock("@/lib/jim/view", () => {
  const actual = jest.requireActual("@/lib/jim/view");
  return {
    ...actual,
    fetchView: jest.fn(),
    setViewSaver: jest.fn(actual.setViewSaver),
  };
});
const realView =
  jest.requireActual<typeof import("@/lib/jim/view")>("@/lib/jim/view");
jest.mock("@/lib/jim/host", () => ({
  ...jest.requireActual("@/lib/jim/host"),
  jimRedirectTarget: jest.fn(() => null),
  goTo: jest.fn(),
}));
jest.mock("@/lib/analytics/admin", () => {
  const actual = jest.requireActual("@/lib/analytics/admin");
  return { ...actual, isAdminUser: jest.fn(actual.isAdminUser) };
});
jest.mock("@/lib/jim/push", () => ({
  disablePush: jest.fn(async () => {}),
}));
jest.mock("@/lib/jim/money", () => ({
  clearMoney: jest.fn(),
}));
jest.mock("@/lib/jim/offlineStore", () => ({
  clearAll: jest.fn(async () => {}),
  saveView: jest.fn(async () => {}),
}));
jest.mock("../JimChat", () => {
  const { useState } = jest.requireActual("react");
  return {
    __esModule: true,
    default: function FakeChat({
      api,
      uid,
      onSignOut,
    }: {
      api: string;
      uid: string;
      onSignOut: () => void;
    }) {
      // The uid it was first built for: a remount takes the new one.
      const [mountedFor] = useState(uid);
      return (
        <div
          data-testid="chat"
          data-api={api}
          data-uid={uid}
          data-mounted-for={mountedFor}
        >
          <button type="button" onClick={onSignOut}>
            Chat sign out
          </button>
        </div>
      );
    },
  };
});

const mockClient = jest.mocked(client);
const mockConfig = jest.mocked(config);
let emit: (user: client.AuthUser | null) => void;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchView).mockRejectedValue(new api.JimError("waking"));
  window.localStorage.clear();
  delete window.__JIM_TEST__;
  mockApi = undefined;
  mockConfig.isFirebaseConfigured.mockReturnValue(true);
  mockClient.signOutUser.mockResolvedValue();
  mockClient.signInWithEmail.mockResolvedValue();
  mockClient.watchAuth.mockImplementation(async (cb) => {
    emit = cb;
    return () => {};
  });
});

async function renderGate() {
  render(<JimGate />);
  await waitFor(() => expect(mockClient.watchAuth).toHaveBeenCalled());
}

it("shows a sign-in form with the right keyboards and autofill", async () => {
  await renderGate();
  act(() => emit(null));
  const email = await screen.findByLabelText("Email");
  expect(email).toHaveAttribute("type", "email");
  expect(email).toHaveAttribute("autocomplete", "username");
  expect(screen.getByLabelText("Password")).toHaveAttribute(
    "autocomplete",
    "current-password"
  );
  expect(screen.getByRole("heading", { name: "Jim" })).toBeInTheDocument();
  expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
});

it("signs in with the typed email and password", async () => {
  await renderGate();
  act(() => emit(null));
  await userEvent.type(await screen.findByLabelText("Email"), "a@b.com");
  await userEvent.type(screen.getByLabelText("Password"), "pw");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(mockClient.signInWithEmail).toHaveBeenCalledWith("a@b.com", "pw");
});

it("shows one generic message when sign-in fails", async () => {
  mockClient.signInWithEmail.mockRejectedValue(
    new Error("auth/wrong-password")
  );
  await renderGate();
  act(() => emit(null));
  await userEvent.type(await screen.findByLabelText("Email"), "a@b.com");
  await userEvent.type(screen.getByLabelText("Password"), "pw");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(
    await screen.findByText("Incorrect email or password.")
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toHaveValue("");
});

it("signs out anyone who is not the owner", async () => {
  await renderGate();
  act(() => emit({ uid: "someone-else", email: "x@y.com" }));
  expect(await screen.findByText(/Not authorized/)).toBeInTheDocument();
  expect(mockClient.signOutUser).toHaveBeenCalled();
  expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
});

it("says Jim isn't connected while there is no server URL", async () => {
  mockApi = "";
  expect(api.JIM_API).toBe("");
  await renderGate();
  act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
  expect(
    await screen.findByText("Jim isn't connected yet")
  ).toBeInTheDocument();
  expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
  // The owner's browser stops counting in analytics, as with /admin.
  expect(window.localStorage.getItem("analytics-exclude")).toBe("1");
});

it("opens the chat for the owner when the server URL is set", async () => {
  window.__JIM_TEST__ = { api: "https://jim.example.test" };
  await renderGate();
  act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
  expect(await screen.findByTestId("chat")).toHaveAttribute(
    "data-api",
    "https://jim.example.test"
  );
});

it("opens the chat on the deployed server for the owner", async () => {
  await renderGate();
  act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
  expect(await screen.findByTestId("chat")).toHaveAttribute(
    "data-api",
    "https://jim-997603129413.us-central1.run.app"
  );
});

it("signs out from the not-connected screen", async () => {
  mockApi = "";
  await renderGate();
  act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
  await userEvent.click(await screen.findByRole("button", { name: "Menu" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
  await waitFor(() => expect(mockClient.signOutUser).toHaveBeenCalled());
});

it("sends other domains to gentryriggen.com/jim before loading sign-in", async () => {
  jest.mocked(host.jimRedirectTarget).mockReturnValueOnce(host.JIM_URL);
  render(<JimGate />);
  await waitFor(() =>
    expect(host.goTo).toHaveBeenCalledWith("https://gentryriggen.com/jim")
  );
  expect(mockClient.watchAuth).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("stays put on gentryriggen.com", async () => {
  await renderGate();
  expect(host.goTo).not.toHaveBeenCalled();
});

/** Puts a Notes payload in the session cache, as opening Notes would. */
async function fillViewCache() {
  await realView.fetchView(
    async () => "t",
    (async () =>
      ({
        status: 200,
        ok: true,
        json: async () => VIEW_FIXTURE,
      }) as Response) as typeof fetch,
    "https://jim.example.test"
  );
  expect(getCachedView()).not.toBeNull();
}

it("forgets the Notes data on sign out", async () => {
  window.__JIM_TEST__ = { api: "https://jim.example.test" };
  await renderGate();
  act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
  await fillViewCache();
  await userEvent.click(
    await screen.findByRole("button", { name: "Chat sign out" })
  );
  expect(getCachedView()).toBeNull();
});

it("forgets the Notes data when the sign-in goes away", async () => {
  window.__JIM_TEST__ = { api: "https://jim.example.test" };
  await renderGate();
  act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
  await screen.findByTestId("chat");
  await fillViewCache();
  act(() => emit(null));
  expect(getCachedView()).toBeNull();
});

describe("early wake-up and kept chat", () => {
  const prefetch = jest.mocked(fetchView);

  it("wakes the server and fetches Notes once the owner is in", async () => {
    window.__JIM_TEST__ = { api: "https://jim.example.test" };
    await renderGate();
    expect(api.wakeJim).not.toHaveBeenCalled();
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    expect(await screen.findByTestId("chat")).toHaveAttribute(
      "data-uid",
      ADMIN_UID
    );
    expect(api.wakeJim).toHaveBeenCalledTimes(1);
    expect(api.wakeJim).toHaveBeenCalledWith("https://jim.example.test");
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch.mock.calls[0][2]).toBe("https://jim.example.test");
    // The same sign-in reported again doesn't wake it twice.
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    expect(api.wakeJim).toHaveBeenCalledTimes(1);
  });

  it("doesn't wake anything for a stranger or with no server", async () => {
    await renderGate();
    act(() => emit({ uid: "someone-else", email: "x@y.com" }));
    await screen.findByText(/Not authorized/);
    expect(api.wakeJim).not.toHaveBeenCalled();
    expect(prefetch).not.toHaveBeenCalled();
  });

  it("wipes the kept chat on sign out", async () => {
    window.__JIM_TEST__ = { api: "https://jim.example.test" };
    saveHistory(ADMIN_UID, {
      session: "s",
      messages: [{ id: 0, from: "me", text: "remember the milk" }],
    });
    await renderGate();
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Chat sign out" })
    );
    expect(window.localStorage.getItem(historyKey(ADMIN_UID))).toBeNull();
  });

  it("builds a fresh chat when the signed-in user changes", async () => {
    window.__JIM_TEST__ = { api: "https://jim.example.test" };
    jest
      .mocked(admin.isAdminUser)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    await renderGate();
    act(() => emit({ uid: "owner-a", email: "a@x.com" }));
    expect(await screen.findByTestId("chat")).toHaveAttribute(
      "data-mounted-for",
      "owner-a"
    );
    act(() => emit({ uid: "owner-b", email: "b@x.com" }));
    expect(screen.getByTestId("chat")).toHaveAttribute(
      "data-mounted-for",
      "owner-b"
    );
  });

  it("wipes any kept chat when the sign-in is gone", async () => {
    saveHistory(ADMIN_UID, { session: "s", messages: [] });
    await renderGate();
    act(() => emit(null));
    expect(loadHistory(ADMIN_UID)).toBeNull();
  });
});

describe("device storage and the morning briefing", () => {
  it("sign-out wipes the kept payloads and turns this device's push off", async () => {
    window.__JIM_TEST__ = { api: "https://jim.example.test" };
    mockClient.getIdToken.mockResolvedValue("tok");
    await renderGate();
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Chat sign out" })
    );
    expect(offline.clearAll).toHaveBeenCalled();
    // The money summary held in memory goes too.
    expect(money.clearMoney).toHaveBeenCalled();
    expect(push.disablePush).toHaveBeenCalledTimes(1);
    const [getToken, , api] = jest.mocked(push.disablePush).mock.calls[0];
    expect(api).toBe("https://jim.example.test");
    // The token was taken before the sign-out went through.
    await expect(getToken!()).resolves.toBe("tok");
    await waitFor(() => expect(mockClient.signOutUser).toHaveBeenCalled());
  });

  it("signs out even when no token comes (offline)", async () => {
    jest.useFakeTimers();
    try {
      window.__JIM_TEST__ = { api: "https://jim.example.test" };
      mockClient.getIdToken.mockReturnValue(new Promise(() => {}));
      await renderGate();
      act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
      act(() => screen.getByRole("button", { name: "Chat sign out" }).click());
      // The sign-in form shows at once, before Firebase hears of it.
      expect(screen.queryByTestId("chat")).toBeNull();
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(offline.clearAll).toHaveBeenCalled();
      expect(mockClient.signOutUser).not.toHaveBeenCalled();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2_000);
      });
      expect(mockClient.signOutUser).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("wipes the kept payloads when the sign-in goes away", async () => {
    await renderGate();
    act(() => emit(null));
    expect(offline.clearAll).toHaveBeenCalled();
    expect(money.clearMoney).toHaveBeenCalled();
  });

  it("keeps each good Notes payload under the owner's uid", async () => {
    window.__JIM_TEST__ = { api: "https://jim.example.test" };
    await renderGate();
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    await fillViewCache();
    expect(offline.saveView).toHaveBeenCalledWith(
      ADMIN_UID,
      expect.objectContaining({ today: VIEW_FIXTURE.today })
    );
  });
});

describe("a sign-out that is cut short", () => {
  /** A lock as the device keeps it (its contents don't matter here). */
  const LOCK = JSON.stringify({ v: 1, salt: "", hash: "", iterations: 1 });

  function deferred() {
    let resolve: () => void = () => {};
    let reject: (err: unknown) => void = () => {};
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  beforeEach(() => {
    window.__JIM_TEST__ = { api: "https://jim.example.test" };
    window.localStorage.setItem(lockKey(ADMIN_UID), LOCK);
    mockClient.getIdToken.mockResolvedValue("tok");
  });

  it("keeps the lock until Firebase has signed out, the marker set first", async () => {
    const out = deferred();
    mockClient.signOutUser.mockReturnValue(out.promise);
    await renderGate();
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Chat sign out" })
    );
    await waitFor(() => expect(mockClient.signOutUser).toHaveBeenCalled());
    // Still signing out: the marker is down and the lock is still there.
    expect(isWipePending()).toBe(true);
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBe(LOCK);
    await act(async () => out.resolve());
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBeNull();
    expect(isWipePending()).toBe(false);
  });

  it("a failed sign-out stays locked and says so, and Try again finishes it", async () => {
    mockClient.signOutUser.mockRejectedValueOnce(new Error("offline"));
    await renderGate();
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Chat sign out" })
    );
    expect(
      await screen.findByText(/Couldn't finish signing out/)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chat")).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBe(LOCK);
    expect(isWipePending()).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBeNull();
    expect(isWipePending()).toBe(false);
  });

  it("is finished on the next load, and the owner never opens meanwhile", async () => {
    markWipePending();
    const out = deferred();
    mockClient.signOutUser.mockReturnValue(out.promise);
    await renderGate();
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    expect(screen.getByRole("status")).toHaveTextContent("Signing out…");
    expect(screen.queryByTestId("chat")).toBeNull();
    expect(mockClient.signOutUser).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBe(LOCK);
    await act(async () => out.resolve());
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBeNull();
    expect(isWipePending()).toBe(false);
  });

  it("a fresh password sign-in ends a leftover wipe and opens", async () => {
    await renderGate();
    act(() => emit(null));
    markWipePending();
    window.localStorage.setItem(lockKey(ADMIN_UID), LOCK);
    mockClient.signInWithEmail.mockImplementation(async () => {
      emit({ uid: ADMIN_UID, email: "me@x.com" });
    });
    await userEvent.type(await screen.findByLabelText("Email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByTestId("chat")).toBeInTheDocument();
    expect(isWipePending()).toBe(false);
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBeNull();
    expect(mockClient.signOutUser).not.toHaveBeenCalled();
  });

  it("drops the Notes saver before clearing the device store", async () => {
    const saver = jest.mocked(view.setViewSaver);
    await renderGate();
    act(() => emit({ uid: ADMIN_UID, email: "me@x.com" }));
    saver.mockClear();
    jest.mocked(offline.clearAll).mockClear();
    await userEvent.click(
      await screen.findByRole("button", { name: "Chat sign out" })
    );
    expect(saver).toHaveBeenCalledWith(null);
    expect(saver.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(offline.clearAll).mock.invocationCallOrder[0]
    );
  });
});

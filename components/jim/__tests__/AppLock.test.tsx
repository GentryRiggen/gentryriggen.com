import { webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ADMIN_UID } from "@/lib/analytics/admin";
import * as client from "@/lib/jim/auth";
import {
  createLock,
  HIDDEN_KEY,
  isWipePending,
  loadLock,
  lockKey,
  saveLock,
  type LockRecord,
} from "@/lib/jim/appLock";
import { toBase64Url } from "@/lib/jim/faceId";
import { historyKey, saveHistory } from "@/lib/jim/history";
import { JimPlayer } from "@/lib/jim/player";
import JimChat from "../JimChat";
import JimGate from "../JimGate";
import type { AppLock } from "../useAppLock";

// jsdom has neither; the browser's are the same API.
Object.defineProperty(globalThis.crypto, "subtle", {
  value: webcrypto.subtle,
  configurable: true,
});
Object.assign(globalThis, { TextEncoder });

jest.mock("@/lib/jim/auth");
jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return { ...actual, streamToJim: jest.fn(), wakeJim: jest.fn() };
});
jest.mock("@/lib/jim/view", () => ({
  ...jest.requireActual("@/lib/jim/view"),
  fetchView: jest.fn(() => Promise.reject(new Error("offline"))),
}));
jest.mock("@/lib/jim/push", () => ({
  ...jest.requireActual("@/lib/jim/push"),
  disablePush: jest.fn(async () => {}),
}));
jest.mock("@/lib/jim/offlineStore", () => ({
  clearAll: jest.fn(async () => {}),
  saveView: jest.fn(async () => {}),
}));
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => <div>Notes secret</div>,
}));

const API = "https://jim.example.test";
const SECRET = "The garden key is under the blue pot";
/** Fewer rounds than a real lock, to keep the tests quick. */
const FAST = 1_000;

let visibility: DocumentVisibilityState = "visible";
Object.defineProperty(document, "visibilityState", {
  configurable: true,
  get: () => visibility,
});

function setVisible(next: DocumentVisibilityState) {
  act(() => {
    visibility = next;
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/**
 * A lock as set before the PIN's length was kept (OK or Enter unlocks);
 * pass `length` in `extra` for one that unlocks on the last digit.
 */
async function presetLock(
  extra: Partial<LockRecord> = {},
  pin = "1234"
): Promise<LockRecord> {
  const { length: _length, ...older } = await createLock(pin, 0, FAST);
  void _length;
  const record = { ...older, ...extra };
  saveLock(ADMIN_UID, record);
  return record;
}

async function renderJim() {
  render(<JimGate />);
  // Either the chat or the lock screen, once sign-in is known.
  await waitFor(() =>
    expect(
      screen.queryByLabelText("Message") ??
        screen.queryByRole("heading", { name: "Enter PIN" })
    ).toBeInTheDocument()
  );
}

async function enterPin(pin: string, submit = "OK") {
  for (const digit of pin) {
    await userEvent.click(screen.getByRole("button", { name: digit }));
  }
  await userEvent.click(screen.getByRole("button", { name: submit }));
}

function isLocked(): boolean {
  return screen.queryByRole("heading", { name: "Enter PIN" }) !== null;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  visibility = "visible";
  window.__JIM_TEST__ = { signedIn: true, api: API };
  jest.mocked(client.signOutUser).mockResolvedValue();
  saveHistory(ADMIN_UID, {
    session: "s1",
    messages: [{ id: 0, from: "jim", text: SECRET }],
  });
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  jest.useRealTimers();
  delete window.__JIM_TEST__;
});

describe("without a lock", () => {
  it("opens straight to the chat and offers to set one", async () => {
    await renderJim();
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen.getByRole("menuitem", { name: "App lock: Off" })
    ).toBeInTheDocument();
  });

  it("sets a PIN twice, then when it locks, without locking now", async () => {
    await renderJim();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: Off" })
    );
    const sheet = screen.getByRole("dialog", { name: "App lock" });
    expect(within(sheet).getByText(/Choose a PIN/)).toBeInTheDocument();
    await enterPin("2580", "Next");
    expect(within(sheet).getByText("Enter it again")).toBeInTheDocument();
    await enterPin("2581", "Next");
    expect(
      within(sheet).getByText("The PINs didn't match. Choose it again.")
    ).toBeInTheDocument();
    await enterPin("2580", "Next");
    await enterPin("2580", "Next");
    expect(screen.getByRole("radio", { name: /Immediately/ })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "5 minutes" }));
    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    const record = loadLock(ADMIN_UID);
    expect(record).toMatchObject({ after: 300, iterations: 310_000 });
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).not.toContain(
      "2580"
    );
    expect(isLocked()).toBe(false);
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen.getByRole("menuitem", { name: "App lock: On" })
    ).toBeInTheDocument();
  });
});

describe("locked", () => {
  it("starts locked and draws nothing of the chat or Notes", async () => {
    await presetLock();
    await renderJim();
    expect(isLocked()).toBe(true);
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET);
    expect(document.body.textContent).not.toContain("Notes secret");
  });

  it("says a wrong PIN, then opens on the right one", async () => {
    await presetLock();
    await renderJim();
    await enterPin("0000");
    expect(
      await screen.findByText("Wrong PIN. 9 attempts left.")
    ).toBeInTheDocument();
    expect(isLocked()).toBe(true);
    await enterPin("1234");
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
    expect(isLocked()).toBe(false);
    expect(loadLock(ADMIN_UID)?.fails).toBe(0);
  });

  it("takes digits from the keypad and a keyboard, with dots for each", async () => {
    await presetLock();
    await renderJim();
    const ok = screen.getByRole("button", { name: "OK" });
    await userEvent.click(screen.getByRole("button", { name: "1" }));
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByLabelText("PIN")).toHaveAccessibleDescription(
      "2 digits entered"
    );
    expect(ok).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByLabelText("PIN")).toHaveAccessibleDescription(
      "1 digit entered"
    );
    await userEvent.keyboard("23456789");
    // Eight at most.
    expect(screen.getByLabelText("PIN")).toHaveAccessibleDescription(
      "8 digits entered"
    );
    await userEvent.keyboard("{Backspace>4/}");
    expect(screen.getByLabelText("PIN")).toHaveAccessibleDescription(
      "4 digits entered"
    );
    expect(ok).toBeEnabled();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
  });

  it("makes you wait after too many, through a reload", async () => {
    await presetLock({ fails: 5, lockedUntil: Date.now() + 30_000 });
    await renderJim();
    expect(
      screen.getByText(/Too many wrong PINs\. Try again in 0:(30|29)\./)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toBeDisabled();
  });

  it("a wait from a clock set backwards starts over, not a year long", async () => {
    // The last wrong PIN "happened" a year from now: the clock went back.
    const year = 365 * 24 * 3_600_000;
    await presetLock({
      fails: 5,
      lastFail: Date.now() + year,
      lockedUntil: Date.now() + year + 30_000,
    });
    await renderJim();
    expect(
      await screen.findByText(/Try again in 0:(31|30|29)\./)
    ).toBeInTheDocument();
    expect(loadLock(ADMIN_UID)?.lockedUntil).toBeLessThanOrEqual(
      Date.now() + 30_000
    );
  });

  it("signs out and wipes the device after the tenth wrong PIN", async () => {
    await presetLock({ fails: 9 });
    await renderJim();
    await enterPin("0000");
    expect(
      await screen.findByText(/Too many wrong PINs\. You're signed out/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBeNull();
    expect(window.localStorage.getItem(historyKey(ADMIN_UID))).toBeNull();
    expect(isWipePending()).toBe(false);
  });

  it("Forgot PIN explains, then signs out and wipes", async () => {
    await presetLock();
    await renderJim();
    await userEvent.click(screen.getByRole("button", { name: "Forgot PIN?" }));
    expect(screen.getByText(/Signing out wipes this device/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(isLocked()).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Forgot PIN?" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Sign out and wipe" })
    );
    expect(await screen.findByText(/Sign in to set a new PIN/)).toBeVisible();
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBeNull();
    expect(window.localStorage.getItem(historyKey(ADMIN_UID))).toBeNull();
  });

  it("sign-out from the menu wipes the lock too", async () => {
    await presetLock();
    await renderJim();
    await enterPin("1234");
    await screen.findByText(SECRET);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(window.localStorage.getItem(lockKey(ADMIN_UID))).toBeNull();
    expect(window.sessionStorage.getItem(HIDDEN_KEY)).toBeNull();
  });
});

describe("the keyboard and the iPhone number pad", () => {
  function pinBox(): HTMLInputElement {
    return screen.getByLabelText("PIN") as HTMLInputElement;
  }

  function finePointer(fine: boolean) {
    jest.mocked(window.matchMedia).mockImplementation(
      (query: string) =>
        ({
          matches: fine && query === "(pointer: fine)",
          media: query,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          addListener: jest.fn(),
          removeListener: jest.fn(),
          onchange: null,
          dispatchEvent: jest.fn(),
        }) as MediaQueryList
    );
  }

  afterEach(() => finePointer(false));

  /** Holds every PIN hash until the returned function is called. */
  function holdHashing(): () => void {
    const subtle = globalThis.crypto.subtle;
    const derive = subtle.deriveBits.bind(subtle);
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const spy = jest
      .spyOn(subtle, "deriveBits")
      .mockImplementation(async (...args) => {
        await held;
        return derive(...args);
      });
    return () => {
      release();
      spy.mockRestore();
    };
  }

  it("is a numeric password box with no autofill, behind the dots", async () => {
    await presetLock();
    await renderJim();
    const box = pinBox();
    // Not a password field: browsers' password managers would offer to
    // save it as a login.
    expect(box).toHaveAttribute("type", "text");
    expect(box).toHaveAttribute("autocapitalize", "off");
    expect(box).toHaveAttribute("data-form-type", "other");
    expect(box.closest("form")).toBeNull();
    expect(box).toHaveAccessibleDescription("0 digits entered");
    // The dots are said once, by the box.
    expect(screen.queryByRole("img", { name: /digits? entered/ })).toBeNull();
    expect(box).toHaveAttribute("inputmode", "numeric");
    expect(box).toHaveAttribute("pattern", "[0-9]*");
    expect(box).toHaveAttribute("autocomplete", "off");
    expect(box).toHaveAttribute("autocorrect", "off");
    expect(box).toHaveAttribute("spellcheck", "false");
    expect(box).toHaveAttribute("enterkeyhint", "go");
    expect(box).toHaveAttribute("maxlength", "8");
    expect(box).toHaveAttribute("data-1p-ignore");
    expect(box).toHaveAttribute("data-lpignore", "true");
    expect(box).not.toHaveAttribute("name");
    expect(box).not.toHaveAttribute("id");
    expect(box.className).toMatch(/text-base/);
  });

  it("focuses itself only with a fine pointer (no keyboard over the pad on a phone)", async () => {
    await presetLock();
    await renderJim();
    expect(pinBox()).not.toHaveFocus();
  });

  it("focuses itself on a desktop", async () => {
    finePointer(true);
    await presetLock();
    await renderJim();
    await waitFor(() => expect(pinBox()).toHaveFocus());
  });

  it("takes digits only, typed or pasted, once each", async () => {
    await presetLock();
    await renderJim();
    await userEvent.click(pinBox());
    await userEvent.keyboard("1a2-");
    expect(pinBox().value).toBe("12");
    expect(screen.getByLabelText("PIN")).toHaveAccessibleDescription(
      "2 digits entered"
    );
    await userEvent.paste("3 4-5x");
    expect(pinBox().value).toBe("12345");
    await userEvent.keyboard("{Backspace}");
    expect(pinBox().value).toBe("1234");
    // The keypad adds to the same PIN.
    await userEvent.click(screen.getByRole("button", { name: "9" }));
    expect(pinBox().value).toBe("12349");
    await userEvent.click(pinBox());
    await userEvent.paste("99999");
    expect(pinBox().value).toBe("12349999");
  });

  it("empties the box as soon as a check starts", async () => {
    await presetLock();
    await renderJim();
    const release = holdHashing();
    try {
      await userEvent.type(pinBox(), "1234{Enter}");
      // Still checking: the PIN is no longer in the page.
      expect(isLocked()).toBe(true);
      expect(pinBox().value).toBe("");
    } finally {
      release();
    }
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
  });

  it("gives focus back to the menu when the sheet closes on a desktop", async () => {
    finePointer(true);
    await renderJim();
    const menu = screen.getByRole("button", { name: "Menu" });
    await userEvent.click(menu);
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: Off" })
    );
    const sheet = screen.getByRole("dialog", { name: "App lock" });
    await waitFor(() =>
      expect(within(sheet).getByLabelText("PIN")).toHaveFocus()
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it("empties the box while a new PIN is saved", async () => {
    await presetLock({ after: 0 });
    await renderJim();
    await enterPin("1234");
    await screen.findByText(SECRET);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: On" })
    );
    const sheet = screen.getByRole("dialog", { name: "App lock" });
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Change PIN" })
    );
    await enterPin("1234");
    await within(sheet).findByText(/Choose a new PIN/);
    await enterPin("86420", "Next");
    const release = holdHashing();
    try {
      await userEvent.type(within(sheet).getByLabelText("PIN"), "86420{Enter}");
      expect(within(sheet).getByLabelText("PIN")).toHaveValue("");
    } finally {
      release();
    }
    expect(await within(sheet).findByText("PIN changed.")).toBeVisible();
  });

  it("Enter in the box unlocks", async () => {
    await presetLock();
    await renderJim();
    await userEvent.type(pinBox(), "1234{Enter}");
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
  });

  it("Enter on a key of the pad submits instead of pressing it", async () => {
    await presetLock();
    await renderJim();
    await userEvent.keyboard("1234");
    screen.getByRole("button", { name: "7" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
  });

  it("Enter on Forgot PIN? opens it and checks nothing", async () => {
    await presetLock();
    await renderJim();
    await userEvent.keyboard("0000");
    screen.getByRole("button", { name: "Forgot PIN?" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText(/Signing out wipes this device/)).toBeVisible();
    expect(loadLock(ADMIN_UID)?.fails).toBe(0);
  });

  it("without a known length, waits for OK or Enter", async () => {
    await presetLock();
    await renderJim();
    await userEvent.keyboard("0000");
    await act(async () => {});
    expect(screen.queryByText(/Wrong PIN/)).toBeNull();
    expect(loadLock(ADMIN_UID)?.fails).toBe(0);
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByText("Wrong PIN. 9 attempts left.")
    ).toBeInTheDocument();
  });

  it("with a known length, checks once as the last digit goes in", async () => {
    await presetLock({ length: 4 });
    await renderJim();
    await userEvent.click(screen.getByRole("button", { name: "0" }));
    await userEvent.click(screen.getByRole("button", { name: "0" }));
    await userEvent.click(screen.getByRole("button", { name: "0" }));
    expect(loadLock(ADMIN_UID)?.fails).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "0" }));
    expect(
      await screen.findByText("Wrong PIN. 9 attempts left.")
    ).toBeInTheDocument();
    expect(loadLock(ADMIN_UID)?.fails).toBe(1);
    expect(pinBox().value).toBe("");
    // Typed on the number pad: no return key needed.
    await userEvent.type(pinBox(), "1234");
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
    expect(loadLock(ADMIN_UID)?.fails).toBe(0);
  });

  it("never checks a shorter part of a longer PIN", async () => {
    await presetLock({ length: 6 }, "123456");
    await renderJim();
    await userEvent.type(pinBox(), "1234");
    await act(async () => {});
    expect(isLocked()).toBe(true);
    expect(loadLock(ADMIN_UID)?.fails).toBe(0);
    await userEvent.type(pinBox(), "56");
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
  });

  it("learns the length from a right PIN on an older lock", async () => {
    await presetLock();
    await renderJim();
    await enterPin("1234");
    await screen.findByText(SECRET);
    expect(loadLock(ADMIN_UID)?.length).toBe(4);
  });

  it("keeps the length when a PIN is set or changed; setting one never jumps ahead", async () => {
    await renderJim();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: Off" })
    );
    const sheet = screen.getByRole("dialog", { name: "App lock" });
    await userEvent.type(within(sheet).getByLabelText("PIN"), "2580");
    await act(async () => {});
    expect(within(sheet).getByText(/Choose a PIN/)).toBeVisible();
    await userEvent.keyboard("{Enter}");
    expect(within(sheet).getByText("Enter it again")).toBeVisible();
    await userEvent.type(within(sheet).getByLabelText("PIN"), "2580{Enter}");
    await userEvent.click(
      await screen.findByRole("button", { name: "Turn on" })
    );
    await waitFor(() => expect(loadLock(ADMIN_UID)?.length).toBe(4));

    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: On" })
    );
    const again = screen.getByRole("dialog", { name: "App lock" });
    await userEvent.click(
      within(again).getByRole("button", { name: "Change PIN" })
    );
    await enterPin("2580");
    await within(again).findByText(/Choose a new PIN/);
    await enterPin("975310", "Next");
    await enterPin("975310", "Next");
    expect(await within(again).findByText("PIN changed.")).toBeVisible();
    expect(loadLock(ADMIN_UID)?.length).toBe(6);
  });
});

describe("when it locks again", () => {
  async function unlocked(after: number) {
    await presetLock({ after });
    await renderJim();
    await enterPin("1234");
    await screen.findByText(SECRET);
    jest.useFakeTimers({ now: new Date("2026-10-31T12:00:00Z") });
  }

  it("Immediately: the moment the app is hidden", async () => {
    await unlocked(0);
    setVisible("hidden");
    // Before coming back, for the app switcher's snapshot.
    expect(isLocked()).toBe(true);
    expect(document.body.textContent).not.toContain(SECRET);
    setVisible("visible");
    expect(isLocked()).toBe(true);
  });

  it.each([60, 300, 900])("after %i s away, not sooner", async (after) => {
    await unlocked(after);
    setVisible("hidden");
    expect(window.sessionStorage.getItem(HIDDEN_KEY)).not.toBeNull();
    expect(isLocked()).toBe(false);
    act(() => jest.advanceTimersByTime(after * 1000 - 1000));
    setVisible("visible");
    expect(isLocked()).toBe(false);
    expect(screen.getByText(SECRET)).toBeInTheDocument();

    setVisible("hidden");
    act(() => jest.advanceTimersByTime(after * 1000));
    setVisible("visible");
    expect(isLocked()).toBe(true);
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it("counts time away on the monotonic clock when the wall clock stalls", async () => {
    await unlocked(60);
    const tick = jest.spyOn(performance, "now").mockReturnValue(1_000);
    setVisible("hidden");
    tick.mockReturnValue(61_000);
    setVisible("visible");
    expect(isLocked()).toBe(true);
    tick.mockRestore();
  });

  it("locks when the wall clock went backwards while away", async () => {
    await unlocked(900);
    setVisible("hidden");
    jest.setSystemTime(new Date("2026-10-31T11:00:00Z"));
    setVisible("visible");
    expect(isLocked()).toBe(true);
  });

  it("handles pagehide and a back-forward cache return the same way", async () => {
    await unlocked(60);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    act(() => jest.advanceTimersByTime(61_000));
    act(() => {
      const event = new Event("pageshow");
      Object.defineProperty(event, "persisted", { value: true });
      window.dispatchEvent(event);
    });
    expect(isLocked()).toBe(true);
  });

  it("Lock now in the menu locks", async () => {
    await presetLock({ after: 900 });
    await renderJim();
    await enterPin("1234");
    await screen.findByText(SECRET);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: On" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Lock now" }));
    expect(isLocked()).toBe(true);
  });
});

describe("settings, behind the PIN", () => {
  async function openSettings() {
    await presetLock({ after: 0 });
    await renderJim();
    await enterPin("1234");
    await screen.findByText(SECRET);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: On" })
    );
    return screen.getByRole("dialog", { name: "App lock" });
  }

  it("turns off only with the current PIN", async () => {
    const sheet = await openSettings();
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Turn off app lock" })
    );
    expect(within(sheet).getByText("Enter your current PIN")).toBeVisible();
    await enterPin("9999");
    expect(
      await within(sheet).findByText("Wrong PIN. 9 attempts left.")
    ).toBeVisible();
    expect(loadLock(ADMIN_UID)).not.toBeNull();
    await enterPin("1234");
    await waitFor(() => expect(loadLock(ADMIN_UID)).toBeNull());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("changes the PIN after the current one", async () => {
    const sheet = await openSettings();
    const before = loadLock(ADMIN_UID);
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Change PIN" })
    );
    await enterPin("1234");
    expect(await within(sheet).findByText(/Choose a new PIN/)).toBeVisible();
    await enterPin("86420", "Next");
    await enterPin("86420", "Next");
    expect(await within(sheet).findByText("PIN changed.")).toBeVisible();
    const after = loadLock(ADMIN_UID);
    expect(after?.salt).not.toBe(before?.salt);
    expect(after?.after).toBe(0);
  });

  it("changes when it locks after the current PIN", async () => {
    const sheet = await openSettings();
    await userEvent.click(
      within(sheet).getByRole("button", { name: /Lock after/ })
    );
    await enterPin("1234");
    await userEvent.click(
      await screen.findByRole("radio", { name: "15 minutes" })
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Save" }));
    expect(loadLock(ADMIN_UID)?.after).toBe(900);
    expect(within(sheet).getByText("Locks after: 15 minutes.")).toBeVisible();
  });
});

describe("Face ID", () => {
  const ID = new Uint8Array([7, 7, 7, 7]);
  const get = jest.fn();
  const create = jest.fn();

  beforeEach(() => {
    get.mockReset();
    create.mockReset();
    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: {
        isUserVerifyingPlatformAuthenticatorAvailable: async () => true,
      },
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get, create },
    });
  });

  it("asks only when tapped, then unlocks", async () => {
    get.mockResolvedValue({ type: "public-key", rawId: ID.buffer });
    await presetLock({ credential: toBase64Url(ID), fails: 3 });
    await renderJim();
    const button = await screen.findByRole("button", {
      name: "Unlock with Face ID",
    });
    setVisible("hidden");
    setVisible("visible");
    // No prompt nobody asked for.
    expect(get).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
    // The owner is back: the wrong-PIN count starts over.
    expect(loadLock(ADMIN_UID)?.fails).toBe(0);
  });

  it("Enter on the Face ID button submits a typed PIN, not Face ID", async () => {
    await presetLock({ credential: toBase64Url(ID) });
    await renderJim();
    await userEvent.keyboard("1234");
    screen.getByRole("button", { name: "Unlock with Face ID" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("a cancel falls back to the PIN, never loops, and isn't a wrong PIN", async () => {
    get.mockRejectedValue(new DOMException("cancel", "NotAllowedError"));
    await presetLock({ credential: toBase64Url(ID) });
    await renderJim();
    const button = await screen.findByRole("button", {
      name: "Unlock with Face ID",
    });
    await userEvent.click(button);
    expect(
      await screen.findByText("Face ID didn't unlock. Use your PIN.")
    ).toBeVisible();
    // Never asked again by itself.
    setVisible("hidden");
    setVisible("visible");
    expect(get).toHaveBeenCalledTimes(1);
    expect(loadLock(ADMIN_UID)?.fails).toBe(0);
    expect(isLocked()).toBe(true);
    await enterPin("1234");
    expect(await screen.findByText(SECRET)).toBeInTheDocument();
  });

  it("is offered after the PIN is set, and kept with the lock", async () => {
    create.mockResolvedValue({ type: "public-key", rawId: ID.buffer });
    await renderJim();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: Off" })
    );
    await enterPin("1357", "Next");
    await enterPin("1357", "Next");
    await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
    const use = await screen.findByRole("button", { name: "Use Face ID" });
    // Said plainly before choosing.
    expect(
      screen.getByText(
        /iOS lets the phone's passcode stand in for Face ID; anyone who knows your phone passcode can then open Jim\./
      )
    ).toBeVisible();
    await userEvent.click(use);
    expect(await screen.findByText("Face ID is on.")).toBeVisible();
    expect(loadLock(ADMIN_UID)?.credential).toBe(toBase64Url(ID));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("turns off with the PIN from the settings", async () => {
    get.mockRejectedValue(new DOMException("cancel", "NotAllowedError"));
    await presetLock({ credential: toBase64Url(ID) });
    await renderJim();
    await enterPin("1234");
    await screen.findByText(SECRET);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "App lock: On" })
    );
    await userEvent.click(screen.getByRole("button", { name: /Face ID\s*On/ }));
    await enterPin("1234");
    expect(await screen.findByText("Face ID is off.")).toBeVisible();
    expect(loadLock(ADMIN_UID)?.credential).toBeUndefined();
  });
});

describe("JimChat while locked", () => {
  function fakeLock(locked: boolean): AppLock {
    return {
      enabled: true,
      locked,
      after: 0,
      lockedUntil: 0,
      faceId: false,
      pinLength: null,
      faceIdSupported: false,
      lockNow: jest.fn(),
      settleWait: jest.fn(),
      verify: jest.fn(),
      unlockWithPin: jest.fn(),
      unlockWithFaceId: jest.fn(),
      turnOn: jest.fn(),
      changePin: jest.fn(),
      setAfter: jest.fn(),
      enableFaceId: jest.fn(),
      disableFaceId: jest.fn(),
      turnOff: jest.fn(),
    };
  }

  it("renders nothing, stops reading aloud, and keeps the draft", async () => {
    const stop = jest.spyOn(JimPlayer.prototype, "stop");
    const setLocked = jest.spyOn(JimPlayer.prototype, "setLocked");
    const props = {
      uid: ADMIN_UID,
      api: API,
      getToken: async () => "t",
      onSignOut: jest.fn(),
      onWipe: jest.fn(),
    };
    const { container, rerender } = render(
      <JimChat {...props} lock={fakeLock(false)} />
    );
    await userEvent.type(screen.getByLabelText("Message"), "half a thought");
    stop.mockClear();
    rerender(<JimChat {...props} lock={fakeLock(true)} />);
    expect(container).toBeEmptyDOMElement();
    expect(document.body.textContent).not.toContain(SECRET);
    expect(stop).toHaveBeenCalled();
    // The player refuses to start anything until unlocked.
    expect(setLocked).toHaveBeenLastCalledWith(true);
    rerender(<JimChat {...props} lock={fakeLock(false)} />);
    expect(setLocked).toHaveBeenLastCalledWith(false);
    expect(screen.getByLabelText("Message")).toHaveValue("half a thought");
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    stop.mockRestore();
    setLocked.mockRestore();
  });
});

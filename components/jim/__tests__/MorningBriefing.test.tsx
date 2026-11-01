import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as push from "@/lib/jim/push";
import JimChat from "../JimChat";
import { BRIEFING_MESSAGES } from "../useMorningBriefing";

jest.mock("@/lib/jim/push", () => ({
  pushSupported: jest.fn(),
  needsHomeScreen: jest.fn(),
  isIos: jest.fn(),
  currentSubscription: jest.fn(),
  enablePush: jest.fn(),
  disablePush: jest.fn(),
}));
jest.mock("@/lib/jim/pushSettings", () => ({
  getPushSettings: jest.fn().mockResolvedValue({
    kinds: [{ id: "morning", label: "Morning brief", on: true }],
    eveningTime: "21:00",
    lessonTime: "12:00",
  }),
  putPushSettings: jest.fn(),
}));
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => null,
}));

const mocked = jest.mocked(push);
const API = "https://jim.example.test";
const getToken = jest.fn().mockResolvedValue("t");

function renderChat() {
  return render(
    <JimChat uid="uid-1" api={API} getToken={getToken} onSignOut={jest.fn()} />
  );
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
}

/** Menu → Notifications → the sheet, whose first switch is this device's. */
async function openSheet() {
  await openMenu();
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Notifications" })
  );
  return screen.findByRole("dialog", { name: "Notifications" });
}

function master() {
  return screen.getByRole("switch", { name: "Notifications on this device" });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mocked.pushSupported.mockReturnValue(true);
  mocked.needsHomeScreen.mockReturnValue(false);
  mocked.isIos.mockReturnValue(false);
  mocked.currentSubscription.mockResolvedValue(null);
  mocked.enablePush.mockResolvedValue({ ok: true });
  mocked.disablePush.mockResolvedValue();
});

it("sits between New chat and Sign out", async () => {
  renderChat();
  await openMenu();
  await screen.findByRole("menuitem", { name: "Notifications" });
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent)
  ).toEqual([
    "New chat",
    "Persona",
    // jsdom has an Audio element, so reading aloud is offered.
    "Read replies aloud: Off",
    "Notifications",
    "Sign out",
  ]);
});

it("shows this device's state in the sheet", async () => {
  mocked.currentSubscription.mockResolvedValue({} as PushSubscription);
  renderChat();
  await openSheet();
  await waitFor(() => expect(master()).toHaveAttribute("aria-checked", "true"));
  expect(
    await screen.findByRole("switch", { name: "Morning brief" })
  ).toBeInTheDocument();
});

it("turns on from the tap, then says a test is coming", async () => {
  renderChat();
  await openSheet();
  await userEvent.click(master());
  expect(mocked.enablePush).toHaveBeenCalledWith(getToken, undefined, API);
  const notice = await screen.findByRole("alertdialog");
  expect(notice).toHaveTextContent(BRIEFING_MESSAGES.on);
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(master()).toHaveAttribute("aria-checked", "true");
});

it("turns off", async () => {
  mocked.currentSubscription.mockResolvedValue({} as PushSubscription);
  renderChat();
  await openSheet();
  await waitFor(() => expect(master()).toHaveAttribute("aria-checked", "true"));
  await userEvent.click(master());
  expect(mocked.disablePush).toHaveBeenCalledWith(getToken, undefined, API);
  await waitFor(() =>
    expect(master()).toHaveAttribute("aria-checked", "false")
  );
});

it("on an iPhone in Safari, says to add Jim to the Home Screen first", async () => {
  mocked.pushSupported.mockReturnValue(false);
  mocked.needsHomeScreen.mockReturnValue(true);
  renderChat();
  const sheet = await openSheet();
  expect(sheet).toHaveTextContent("Add Jim to your Home Screen first");
  await userEvent.click(master());
  expect(await screen.findByRole("alertdialog")).toHaveTextContent(
    "Add Jim to your Home Screen first (Share → Add to Home Screen), then turn this on there."
  );
  expect(mocked.enablePush).not.toHaveBeenCalled();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("says how to allow notifications again when they're blocked", async () => {
  mocked.enablePush.mockResolvedValue({ ok: false, reason: "denied" });
  mocked.isIos.mockReturnValue(true);
  renderChat();
  await openSheet();
  await userEvent.click(master());
  expect(await screen.findByRole("alertdialog")).toHaveTextContent(
    "Settings → Notifications → Jim"
  );
});

it("says nothing when the prompt is just closed", async () => {
  mocked.enablePush.mockResolvedValue({ ok: false, reason: "dismissed" });
  renderChat();
  await openSheet();
  await userEvent.click(master());
  await waitFor(() => expect(mocked.enablePush).toHaveBeenCalled());
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("isn't offered where push can't work", async () => {
  mocked.pushSupported.mockReturnValue(false);
  renderChat();
  await openMenu();
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent)
  ).toEqual(["New chat", "Persona", "Read replies aloud: Off", "Sign out"]);
});

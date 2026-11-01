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

it("sits between New chat and Sign out, showing this device's state", async () => {
  mocked.currentSubscription.mockResolvedValue({} as PushSubscription);
  renderChat();
  await openMenu();
  await screen.findByRole("menuitem", { name: "Morning briefing: On" });
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent)
  ).toEqual([
    "New chat",
    // jsdom has an Audio element, so reading aloud is offered.
    "Read replies aloud: Off",
    "Morning briefing: On",
    "Sign out",
  ]);
});

it("turns on from the tap, then says a test is coming", async () => {
  renderChat();
  await openMenu();
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Morning briefing: Off" })
  );
  expect(mocked.enablePush).toHaveBeenCalledWith(getToken, undefined, API);
  const notice = await screen.findByRole("alertdialog");
  expect(notice).toHaveTextContent(BRIEFING_MESSAGES.on);
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  await openMenu();
  expect(
    screen.getByRole("menuitem", { name: "Morning briefing: On" })
  ).toBeInTheDocument();
});

it("turns off", async () => {
  mocked.currentSubscription.mockResolvedValue({} as PushSubscription);
  renderChat();
  await openMenu();
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Morning briefing: On" })
  );
  expect(mocked.disablePush).toHaveBeenCalledWith(getToken, undefined, API);
  await openMenu();
  expect(
    await screen.findByRole("menuitem", { name: "Morning briefing: Off" })
  ).toBeInTheDocument();
});

it("on an iPhone in Safari, says to add Jim to the Home Screen first", async () => {
  mocked.pushSupported.mockReturnValue(false);
  mocked.needsHomeScreen.mockReturnValue(true);
  renderChat();
  await openMenu();
  await userEvent.click(
    screen.getByRole("menuitem", { name: "Morning briefing: Off" })
  );
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
  await openMenu();
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Morning briefing: Off" })
  );
  expect(await screen.findByRole("alertdialog")).toHaveTextContent(
    "Settings → Notifications → Jim"
  );
});

it("says nothing when the prompt is just closed", async () => {
  mocked.enablePush.mockResolvedValue({ ok: false, reason: "dismissed" });
  renderChat();
  await openMenu();
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "Morning briefing: Off" })
  );
  await waitFor(() => expect(mocked.enablePush).toHaveBeenCalled());
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("isn't offered where push can't work", async () => {
  mocked.pushSupported.mockReturnValue(false);
  renderChat();
  await openMenu();
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent)
  ).toEqual(["New chat", "Read replies aloud: Off", "Sign out"]);
});

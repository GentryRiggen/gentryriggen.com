import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationsSheet from "../NotificationsSheet";
import { JimError } from "@/lib/jim/api";
import * as push from "@/lib/jim/push";
import * as settingsApi from "@/lib/jim/pushSettings";

jest.mock("@/lib/jim/push", () => ({
  needsHomeScreen: jest.fn(),
}));
jest.mock("@/lib/jim/pushSettings", () => ({
  getPushSettings: jest.fn(),
  putPushSettings: jest.fn(),
}));

const mockedPush = jest.mocked(push);
const get = jest.mocked(settingsApi.getPushSettings);
const put = jest.mocked(settingsApi.putPushSettings);
const getToken = jest.fn().mockResolvedValue("t");
const API = "https://jim.example.test";

const SETTINGS: settingsApi.PushSettings = {
  kinds: [
    { id: "morning", label: "Morning brief", on: true },
    { id: "reminders", label: "Reminders", on: true },
    { id: "evening", label: "Evening wrap", on: true },
  ],
  eveningTime: "21:00",
  lessonTime: "12:00",
};

function renderSheet(
  status: "off" | "on" = "on",
  onToggleMaster: () => void = jest.fn()
) {
  render(
    <NotificationsSheet
      open
      onClose={jest.fn()}
      status={status}
      onToggleMaster={onToggleMaster}
      getToken={getToken}
      api={API}
    />
  );
  return onToggleMaster;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedPush.needsHomeScreen.mockReturnValue(false);
  get.mockResolvedValue(SETTINGS);
  put.mockResolvedValue(SETTINGS);
});

it("lists the server's kinds in its order", async () => {
  renderSheet();
  await screen.findByRole("switch", { name: "Evening wrap" });
  const list = screen.getByRole("list", { name: "What to send" });
  expect(
    within(list)
      .getAllByRole("switch")
      .map((s) => s.textContent)
  ).toEqual(["Morning brief", "Reminders", "Evening wrap"]);
  expect(get).toHaveBeenCalledWith(getToken, undefined, API);
  expect(screen.getByText(/Quiet 10 PM–6:30 AM/)).toBeInTheDocument();
});

it("saves a toggled kind", async () => {
  renderSheet();
  const sw = await screen.findByRole("switch", { name: "Evening wrap" });
  await userEvent.click(sw);
  expect(put).toHaveBeenCalledWith(
    { kinds: { evening: false } },
    getToken,
    undefined,
    API
  );
  expect(sw).toHaveAttribute("aria-checked", "false");
});

it("puts a switch back and says why when saving fails", async () => {
  put.mockRejectedValue(new JimError("server"));
  renderSheet();
  const sw = await screen.findByRole("switch", { name: "Reminders" });
  await userEvent.click(sw);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn't save that setting"
  );
  expect(sw).toHaveAttribute("aria-checked", "true");
});

it("shows the server's own words when it refuses", async () => {
  put.mockRejectedValue(new Error("Evening wrap must be 17:00 or later."));
  renderSheet();
  await userEvent.click(
    await screen.findByRole("switch", { name: "Evening wrap" })
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Evening wrap must be 17:00 or later."
  );
});

it("saves the evening time when it changes", async () => {
  renderSheet();
  const input = await screen.findByLabelText("Evening wrap at");
  expect(input).toHaveValue("21:00");
  expect(input).toHaveAttribute("min", "17:00");
  expect(input).toHaveAttribute("max", "21:45");
  expect(input).toHaveAttribute("step", "900");
  fireEvent.change(input, { target: { value: "20:30" } });
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      { eveningTime: "20:30" },
      getToken,
      undefined,
      API
    )
  );
});

it("with notifications off shows only the master switch", async () => {
  renderSheet("off");
  expect(screen.getAllByRole("switch")).toHaveLength(1);
  expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  expect(get).not.toHaveBeenCalled();
});

it("the master switch hands the tap to the page", async () => {
  const toggle = renderSheet("off");
  await userEvent.click(screen.getByRole("switch"));
  expect(toggle).toHaveBeenCalledTimes(1);
});

it("on an iPhone in Safari, hints at the Home Screen", () => {
  mockedPush.needsHomeScreen.mockReturnValue(true);
  renderSheet("off");
  expect(screen.getByText(/Add Jim to your Home Screen first/)).toBeVisible();
});

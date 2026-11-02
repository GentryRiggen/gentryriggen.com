import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/retro";
import type { RetroData } from "@/lib/jim/view";
import NotesRetro from "../NotesRetro";

jest.mock("@/lib/jim/retro", () => ({
  ...jest.requireActual("@/lib/jim/retro"),
  saveRetro: jest.fn(),
}));
const save = jest.mocked(api.saveRetro);
const getToken = jest.fn().mockResolvedValue("t");
const API = "https://jim.example.test";

const RETRO: RetroData = {
  day: "2026-10-31",
  morning: {
    questions: [
      "What are you looking forward to?",
      "What one thing would make today a win?",
      "How do you want to show up today?",
    ],
    answers: null,
  },
  evening: {
    questions: [
      "What surprised you today?",
      "What went well today?",
      "What would you change?",
    ],
    answers: ["A quiet lunch.", "", "Start earlier."],
  },
};

function setup(props: Partial<React.ComponentProps<typeof NotesRetro>> = {}) {
  const all = {
    kind: "evening" as const,
    retro: RETRO,
    api: API,
    getToken,
    onSwitch: jest.fn(),
    onBack: jest.fn(),
    onSaved: jest.fn(),
    ...props,
  };
  const view = render(<NotesRetro {...all} />);
  return { ...all, ...view };
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setOnline(true);
});

it("shows the server's three questions with the saved answers", () => {
  setup();
  expect(
    screen.getByRole("heading", { name: "Evening retro" })
  ).toBeInTheDocument();
  expect(screen.getByLabelText("What surprised you today?")).toHaveValue(
    "A quiet lunch."
  );
  expect(screen.getByLabelText("What went well today?")).toHaveValue("");
  expect(screen.getByLabelText("What would you change?")).toHaveValue(
    "Start earlier."
  );
  expect(screen.getByText("Saved")).toBeInTheDocument();
});

it("shows the retro's date under the title, whatever the device time zone", () => {
  const tz = process.env.TZ;
  try {
    for (const zone of ["Pacific/Kiritimati", "Pacific/Pago_Pago", "UTC"]) {
      process.env.TZ = zone;
      const { unmount } = setup();
      expect(screen.getByText("Saturday, October 31")).toBeInTheDocument();
      unmount();
    }
  } finally {
    process.env.TZ = tz;
  }
});

it("the morning retro starts empty", () => {
  setup({ kind: "morning" });
  expect(
    screen.getByRole("heading", { name: "Morning retro" })
  ).toBeInTheDocument();
  for (const q of RETRO.morning.questions) {
    expect(screen.getByLabelText(q)).toHaveValue("");
  }
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});

it("switches between morning and evening", async () => {
  const { onSwitch } = setup();
  expect(screen.getByRole("tab", { name: "Evening" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await userEvent.click(screen.getByRole("tab", { name: "Morning" }));
  expect(onSwitch).toHaveBeenCalledWith("morning");
});

it("saves the day it loaded with and says Saved with the time", async () => {
  save.mockResolvedValue({ sha: "abc" });
  const { onSaved } = setup({ kind: "morning" });
  const [q1, , q3] = RETRO.morning.questions;
  await userEvent.type(screen.getByLabelText(q1), "The long walk");
  await userEvent.type(screen.getByLabelText(q3), "Patient");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith(getToken, API, {
    kind: "morning",
    day: "2026-10-31",
    answers: ["The long walk", "", "Patient"],
  });
  expect(await screen.findByText(/^Saved \d/)).toBeInTheDocument();
  expect(onSaved).toHaveBeenCalledWith("morning", "2026-10-31", [
    "The long walk",
    "",
    "Patient",
  ]);
  // Still editable after a save.
  expect(screen.getByLabelText(q1)).toBeEnabled();
});

it("keeps the day it loaded with when a newer day's payload arrives", async () => {
  save.mockResolvedValue({ sha: null });
  const { rerender, ...props } = setup();
  rerender(
    <NotesRetro
      {...props}
      kind="evening"
      retro={{ ...RETRO, day: "2026-11-01" }}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save.mock.calls[0][2].day).toBe("2026-10-31");
});

it("Save is off while every answer is empty", async () => {
  setup({ kind: "morning" });
  const button = screen.getByRole("button", { name: "Save" });
  expect(button).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText(RETRO.morning.questions[1]),
    "   "
  );
  expect(button).toBeDisabled();
  await userEvent.type(screen.getByLabelText(RETRO.morning.questions[1]), "x");
  expect(button).toBeEnabled();
});

it.each([
  "You can only save today's or yesterday's retro.",
  "Jim is busy. Try again in a moment.",
])("shows the server's words as they are: %s", async (message) => {
  save.mockRejectedValue(new Error(message));
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

it("offline: Save is off and says so", async () => {
  setup();
  setOnline(false);
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByText("You're offline")).toBeInTheDocument();
  setOnline(true);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
  );
});

it("without retro data says it isn't available yet, with no Save", () => {
  setup({ retro: undefined });
  expect(
    screen.getByText("Your retro isn't available yet.")
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Save" })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("an edit after a save hides Saved until saved again", async () => {
  setup();
  expect(screen.getByText("Saved")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("What went well today?"), "Lunch");
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});

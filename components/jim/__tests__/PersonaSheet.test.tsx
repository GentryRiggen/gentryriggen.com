import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JimChat from "../JimChat";
import PersonaSheet from "../PersonaSheet";
import { PERSONAS_FRESH_MS, type Personas } from "../usePersonas";

jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => null,
}));

const API = "https://jim.example.test";

const LIST = {
  active: "vega",
  personas: [
    {
      id: "vega",
      name: "Vega",
      summary: "The starship's AI.",
      examples: ["Course plotted, Captain.", "Entered in the log."],
      voice: "Aoede",
    },
    {
      id: "rook",
      name: "Rook",
      summary: "Dry, brief, a little wry.",
      examples: ["Noted. Moving on."],
      voice: "Charon",
    },
  ],
};

interface Reply {
  status: number;
  body?: unknown;
}
type Handler = (body: unknown) => Reply | Promise<Reply>;

/** The server: one handler per path; every call is recorded. */
const routes = new Map<string, Handler>();
const calls: { path: string; body: unknown }[] = [];
const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
  const path = new URL(url).pathname;
  const body: unknown = init.body ? JSON.parse(init.body as string) : null;
  calls.push({ path, body });
  const handler = routes.get(path);
  const { status, body: out } = handler
    ? await handler(body)
    : { status: 404, body: null };
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => out,
    blob: async () => ({ size: 3, type: "audio/mpeg" }),
  } as unknown as Response;
});

class FakeAudio extends EventTarget {
  src = "";
  paused = true;
  ended = false;
  preload = "";
  playbackRate = 1;
  defaultPlaybackRate = 1;
  play = jest.fn(() => Promise.resolve());
  pause = jest.fn();
}

function callsTo(path: string) {
  return calls.filter((c) => c.path === path);
}

function renderChat() {
  return render(
    <JimChat
      uid="uid-1"
      api={API}
      getToken={jest.fn().mockResolvedValue("t")}
      onSignOut={jest.fn()}
    />
  );
}

async function openSheet(label: RegExp = /^Persona/) {
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  await userEvent.click(screen.getByRole("menuitem", { name: label }));
  return screen.getByRole("dialog", { name: "Persona" });
}

function row(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  const item = heading.closest("li");
  if (!item) throw new Error(`no row for ${name}`);
  return item;
}

beforeEach(() => {
  window.localStorage.clear();
  routes.clear();
  calls.length = 0;
  fetchMock.mockClear();
  routes.set("/api/personas", () => ({ status: 200, body: LIST }));
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: fetchMock,
  });
  Object.defineProperty(window, "Audio", {
    configurable: true,
    value: FakeAudio,
  });
  URL.createObjectURL = jest.fn(() => "blob:test/1");
  URL.revokeObjectURL = jest.fn();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "fetch");
  jest.useRealTimers();
});

describe("persona switcher", () => {
  it("loads nothing until the sheet opens", async () => {
    renderChat();
    await act(async () => {});
    expect(callsTo("/api/personas")).toHaveLength(0);
  });

  it("lists every persona with its summary and examples, the active one first and marked", async () => {
    renderChat();
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Vega" });
    const items = within(
      within(sheet).getByRole("list", { name: "Personas" })
    ).getAllByRole("heading");
    expect(items.map((h) => h.textContent)).toEqual(["Vega", "Rook"]);
    expect(row("Vega")).toHaveTextContent("Active");
    expect(row("Vega")).toHaveAttribute("aria-current", "true");
    expect(row("Vega")).toHaveTextContent("The starship's AI.");
    expect(row("Vega")).toHaveTextContent("“Course plotted, Captain.”");
    expect(row("Vega")).toHaveTextContent("“Entered in the log.”");
    expect(
      within(row("Vega")).queryByRole("button", { name: /^Use/ })
    ).toBeNull();
    expect(row("Rook")).not.toHaveTextContent("Active");
    expect(
      within(row("Rook")).getByRole("button", { name: "Use Rook" })
    ).toBeInTheDocument();
    // The menu now knows who is active.
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Persona: Vega" })
    ).toBeInTheDocument();
  });

  it("switches: pending on the row, then marked active and named in the menu", async () => {
    let finish: (reply: Reply) => void = () => {};
    // Held open to see the pending state.
    routes.set(
      "/api/persona",
      () =>
        new Promise<Reply>((resolve) => {
          finish = resolve;
        })
    );

    renderChat();
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Rook" });
    await userEvent.click(screen.getByRole("button", { name: "Use Rook" }));
    expect(callsTo("/api/persona")[0].body).toEqual({ id: "rook" });
    const pending = within(row("Rook")).getByRole("button", {
      name: "Switching…",
    });
    expect(pending).toBeDisabled();
    expect(row("Rook")).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      finish({ status: 200, body: { ok: true, active: "rook" } });
    });
    await waitFor(() => expect(row("Rook")).toHaveTextContent("Active"));
    expect(row("Vega")).not.toHaveTextContent("Active");
    expect(
      within(row("Vega")).getByRole("button", { name: "Use Vega" })
    ).toBeInTheDocument();
    expect(screen.getByText("Now using Rook.")).toBeInTheDocument();
    expect(window.localStorage.getItem("jim:persona-name")).toBe("Rook");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Persona: Rook" })
    ).toBeInTheDocument();
  });

  it("shows a failed switch on its row, with Try again", async () => {
    let attempt = 0;
    routes.set("/api/persona", () => {
      attempt += 1;
      return attempt === 1
        ? { status: 503, body: { error: "Jim is mid-sync. Try again." } }
        : { status: 200, body: { ok: true, active: "rook" } };
    });
    renderChat();
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Rook" });
    await userEvent.click(screen.getByRole("button", { name: "Use Rook" }));
    const alert = await within(row("Rook")).findByRole("alert");
    expect(alert).toHaveTextContent("Jim is mid-sync. Try again.");
    expect(row("Vega")).toHaveTextContent("Active");

    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" })
    );
    await waitFor(() => expect(row("Rook")).toHaveTextContent("Active"));
    expect(within(row("Rook")).queryByRole("alert")).toBeNull();
  });

  it("says when the list can't load, and loads on Try again", async () => {
    let attempt = 0;
    routes.set("/api/personas", () => {
      attempt += 1;
      return attempt === 1 ? { status: 500 } : { status: 200, body: LIST };
    });
    renderChat();
    const sheet = await openSheet();
    const alert = await within(sheet).findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load the personas.");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Try again" })
    );
    await within(sheet).findByRole("heading", { name: "Rook" });
  });

  it("keeps the list for the visit and fetches again after 5 minutes", async () => {
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    renderChat();
    await openSheet();
    await screen.findByRole("heading", { name: "Rook" });
    await userEvent.keyboard("{Escape}");
    await openSheet();
    expect(callsTo("/api/personas")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");

    now.mockReturnValue(1_000_000 + PERSONAS_FRESH_MS + 1);
    await openSheet();
    await waitFor(() => expect(callsTo("/api/personas")).toHaveLength(2));
    now.mockRestore();
  });

  it("is a modal: focus starts on Close, stays inside, and goes back to the menu button", async () => {
    renderChat();
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Rook" });
    const close = within(sheet).getByRole("button", { name: "Close" });
    expect(close).toHaveFocus();
    expect(sheet).toHaveAttribute("aria-modal", "true");
    // Shift+Tab from the first control wraps to the last.
    await userEvent.tab({ shift: true });
    expect(sheet.contains(document.activeElement)).toBe(true);
    await userEvent.tab();
    expect(close).toHaveFocus();

    await userEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
  });

  it("plays a persona's first example in its voice", async () => {
    routes.set("/api/speak", () => ({ status: 200 }));
    renderChat();
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Rook" });
    await userEvent.click(screen.getByRole("button", { name: "Hear Rook" }));
    await waitFor(() => expect(callsTo("/api/speak")).toHaveLength(1));
    expect(callsTo("/api/speak")[0].body).toEqual({
      text: "Noted. Moving on.",
      voice: "Charon",
    });
    expect(
      screen.getByRole("button", { name: "Stop Rook" })
    ).toBeInTheDocument();
  });

  it("names the remembered persona in the menu before anything loads", async () => {
    window.localStorage.setItem("jim:persona-name", "Vega");
    renderChat();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen.getByRole("menuitem", { name: "Persona: Vega" })
    ).toBeInTheDocument();
    expect(callsTo("/api/personas")).toHaveLength(0);
  });

  it("offers no Try again when the persona is gone (404)", async () => {
    routes.set("/api/persona", () => ({ status: 404, body: { error: "x" } }));
    renderChat();
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Rook" });
    await userEvent.click(screen.getByRole("button", { name: "Use Rook" }));
    const alert = await within(row("Rook")).findByRole("alert");
    expect(alert).toHaveTextContent("Jim doesn't have that persona anymore.");
    expect(within(alert).queryByRole("button")).toBeNull();
  });

  it("shows the daily cap on the row when Hear it is refused", async () => {
    routes.set("/api/speak", () => ({
      status: 429,
      body: { error: "Read-aloud has hit today's limit. It resets tomorrow." },
    }));
    renderChat();
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Rook" });
    await userEvent.click(screen.getByRole("button", { name: "Hear Rook" }));
    expect(await within(row("Rook")).findByRole("alert")).toHaveTextContent(
      "Read-aloud has hit today's limit. It resets tomorrow."
    );
    expect(
      screen.getByRole("button", { name: "Hear Rook" })
    ).toBeInTheDocument();
  });

  it("never plays a sample in the browser's voice", async () => {
    const speak = jest.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        speak,
        cancel: jest.fn(),
        getVoices: () => [],
        resume: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        speaking: false,
        pending: false,
      },
    });
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    try {
      routes.set("/api/speak", () => ({ status: 502 }));
      renderChat();
      const sheet = await openSheet();
      await within(sheet).findByRole("heading", { name: "Rook" });
      await userEvent.click(screen.getByRole("button", { name: "Hear Rook" }));
      expect(await within(row("Rook")).findByRole("alert")).toHaveTextContent(
        "Couldn't play this voice."
      );
      expect(speak).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(window, "speechSynthesis");
      Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
    }
  });

  it("makes the chat behind inert and still, and lets it go on close", async () => {
    renderChat();
    const menu = screen.getByRole("button", { name: "Menu" });
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Rook" });
    expect(menu.closest("[inert]")).not.toBeNull();
    expect(sheet.closest("[inert]")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    expect(menu.closest("[inert]")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("never hands focus back to the message box (it would pop the keyboard)", async () => {
    renderChat();
    const box = screen.getByLabelText("Message");
    const sheet = await openSheet();
    await within(sheet).findByRole("heading", { name: "Rook" });
    await userEvent.keyboard("{Escape}");
    expect(box).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
  });

  it("leaves focus alone when it was opened from a text field", () => {
    let field: HTMLElement | null = null;
    const personas = (open: boolean): Personas => ({
      open,
      list: null,
      loading: false,
      loadError: null,
      pending: null,
      rowErrors: {},
      activeName: null,
      announcement: "",
      choose: jest.fn(),
      reload: jest.fn(),
      close: jest.fn(),
      opener: () => field,
      menuItem: { label: "Persona", onSelect: jest.fn() },
    });
    const ui = (open: boolean) => (
      <>
        <textarea aria-label="Box" />
        <PersonaSheet
          personas={personas(open)}
          playingKey={null}
          onHear={null}
          sampleError={null}
        />
      </>
    );
    const { rerender } = render(ui(false));
    field = screen.getByLabelText("Box");
    rerender(ui(true));
    expect(field).not.toHaveFocus();
    rerender(ui(false));
    expect(field).not.toHaveFocus();
  });
});

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import { historyKey } from "@/lib/jim/history";
import { emitOpenIntent } from "@/lib/jim/openUrl";
import * as view from "@/lib/jim/view";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import JimChat from "../JimChat";

jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return { ...actual, streamToJim: jest.fn() };
});
jest.mock("@/lib/jim/view", () => {
  const actual = jest.requireActual("@/lib/jim/view");
  return { ...actual, getCachedView: jest.fn(), fetchView: jest.fn() };
});
jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => null,
}));

const send = jest.mocked(api.streamToJim);
const cached = jest.mocked(view.getCachedView);
const fetched = jest.mocked(view.fetchView);
const QUESTION = "What went well today?";

function renderChat() {
  return render(
    <JimChat
      uid="uid-1"
      api="https://jim.example.test"
      getToken={jest.fn().mockResolvedValue("t")}
      onSignOut={jest.fn()}
    />
  );
}

function reflect() {
  act(() => emitOpenIntent({ listen: null, reflect: true }));
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  cached.mockReturnValue({
    data: { ...VIEW_FIXTURE, reflection: { question: QUESTION } },
    at: Date.now(),
  });
  send.mockResolvedValue({ reply: "Noted.", changed: [], commit: null });
});
afterEach(() => window.history.replaceState(null, "", "/"));

it("shows the question as a local bubble and asks for an answer", async () => {
  renderChat();
  reflect();
  expect(await screen.findByText(QUESTION)).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Your answer…")).toBeInTheDocument();
  expect(fetched).not.toHaveBeenCalled();
  // Local only: nothing is kept in the saved history.
  expect(window.localStorage.getItem(historyKey("uid-1")) ?? "").not.toContain(
    QUESTION
  );
});

it("starts from ?reflect=1 and clears it from the address", async () => {
  window.history.replaceState(null, "", "/jim/chat?reflect=1");
  renderChat();
  expect(await screen.findByText(QUESTION)).toBeInTheDocument();
  expect(window.location.search).toBe("");
});

it("sends the answer with its question, then ends reflect mode", async () => {
  renderChat();
  reflect();
  await screen.findByText(QUESTION);
  await userEvent.type(screen.getByLabelText("Message"), "Shipped the thing");
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(send).toHaveBeenCalled());
  expect(send.mock.calls[0][0]).toBe(
    `Evening reflection. Q: ${QUESTION}\nA: Shipped the thing`
  );
  await screen.findByText("Noted.");
  expect(screen.getByPlaceholderText("Message Jim")).toBeInTheDocument();
  // The question now lives only inside the sent message.
  expect(screen.getAllByText(/What went well today\?/)).toHaveLength(1);
});

it("fetches the view when none is cached", async () => {
  cached.mockReturnValue(null);
  fetched.mockResolvedValue({
    ...VIEW_FIXTURE,
    reflection: { question: QUESTION },
  });
  renderChat();
  reflect();
  expect(await screen.findByText(QUESTION)).toBeInTheDocument();
  expect(fetched).toHaveBeenCalledTimes(1);
});

it("does nothing without a question", async () => {
  cached.mockReturnValue({ data: VIEW_FIXTURE, at: Date.now() });
  fetched.mockResolvedValue(VIEW_FIXTURE);
  renderChat();
  reflect();
  await waitFor(() => expect(fetched).toHaveBeenCalled());
  expect(screen.getByPlaceholderText("Message Jim")).toBeInTheDocument();
});

it("does nothing when the question can't be fetched", async () => {
  cached.mockReturnValue(null);
  fetched.mockRejectedValue(new api.JimError("waking"));
  renderChat();
  reflect();
  await waitFor(() => expect(fetched).toHaveBeenCalled());
  expect(screen.getByPlaceholderText("Message Jim")).toBeInTheDocument();
});

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ADMIN_UID } from "@/lib/analytics/admin";
import * as client from "@/lib/firebase/client";
import * as config from "@/lib/firebase/config";
import * as api from "@/lib/jim/api";
import * as host from "@/lib/jim/host";
import JimGate from "../JimGate";

jest.mock("@/lib/firebase/client");
jest.mock("@/lib/firebase/config");
// The real URL by default; a test sets it to "" for the not-connected state.
let mockApi: string | undefined;
jest.mock("@/lib/jim/api", () => {
  const actual = jest.requireActual("@/lib/jim/api");
  return {
    ...actual,
    get JIM_API() {
      return mockApi ?? actual.JIM_API;
    },
  };
});
jest.mock("@/lib/jim/host", () => ({
  ...jest.requireActual("@/lib/jim/host"),
  jimRedirectTarget: jest.fn(() => null),
  goTo: jest.fn(),
}));
jest.mock("../JimChat", () => ({
  __esModule: true,
  default: ({ api }: { api: string }) => (
    <div data-testid="chat" data-api={api} />
  ),
}));

const mockClient = jest.mocked(client);
const mockConfig = jest.mocked(config);
let emit: (user: client.AuthUser | null) => void;

beforeEach(() => {
  jest.clearAllMocks();
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
  await userEvent.click(
    await screen.findByRole("button", { name: "Sign out" })
  );
  expect(mockClient.signOutUser).toHaveBeenCalled();
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

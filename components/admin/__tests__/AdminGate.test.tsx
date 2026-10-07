import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminGate from "../AdminGate";
import * as client from "@/lib/firebase/client";
import * as config from "@/lib/firebase/config";

jest.mock("@/lib/firebase/client");
jest.mock("@/lib/firebase/config");
jest.mock("../Dashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard" />,
}));

const mockClient = jest.mocked(client);
const mockConfig = jest.mocked(config);

let emit: (user: client.AuthUser | null) => void;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockConfig.isFirebaseConfigured.mockReturnValue(true);
  mockClient.signOutUser.mockResolvedValue();
  mockClient.signInWithGoogle.mockResolvedValue();
  mockClient.watchAuth.mockImplementation(async (cb) => {
    emit = cb;
    return () => {};
  });
});

async function renderGate() {
  render(<AdminGate />);
  await waitFor(() => expect(mockClient.watchAuth).toHaveBeenCalled());
}

it("explains when Firebase is not configured and never loads the SDK", () => {
  mockConfig.isFirebaseConfigured.mockReturnValue(false);
  render(<AdminGate />);
  expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  expect(mockClient.watchAuth).not.toHaveBeenCalled();
});

it("shows only the sign-in button when signed out", async () => {
  await renderGate();
  act(() => emit(null));
  expect(
    await screen.findByRole("button", { name: /sign in with google/i })
  ).toBeInTheDocument();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
});

it("starts the Google sign-in when the button is clicked", async () => {
  await renderGate();
  act(() => emit(null));
  await userEvent.click(
    await screen.findByRole("button", { name: /sign in with google/i })
  );
  expect(mockClient.signInWithGoogle).toHaveBeenCalled();
});

it("rejects another account and signs it out", async () => {
  await renderGate();
  act(() => emit({ email: "someone@gmail.com", emailVerified: true }));
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(mockClient.signOutUser).toHaveBeenCalled();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  // The sign-out echo must not wipe the explanation.
  act(() => emit(null));
  expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
});

it("rejects the admin email when it is unverified", async () => {
  await renderGate();
  act(() => emit({ email: "gentry.riggen@gmail.com", emailVerified: false }));
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
});

it("shows the dashboard for the admin and excludes their own traffic", async () => {
  await renderGate();
  act(() => emit({ email: "gentry.riggen@gmail.com", emailVerified: true }));
  expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
  expect(window.localStorage.getItem("analytics-exclude")).toBe("1");
});

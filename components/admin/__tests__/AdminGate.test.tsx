import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ADMIN_UID } from "@/lib/analytics/admin";
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
  mockClient.signInWithEmail.mockResolvedValue({ kind: "done" });
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

it("shows only the sign-in form when signed out", async () => {
  await renderGate();
  act(() => emit(null));
  expect(await screen.findByLabelText("Email")).toHaveAttribute(
    "type",
    "email"
  );
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
});

it("signs in with the typed email and password", async () => {
  await renderGate();
  act(() => emit(null));
  await userEvent.type(await screen.findByLabelText("Email"), "a@b.com");
  await userEvent.type(screen.getByLabelText("Password"), "hunter2");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(mockClient.signInWithEmail).toHaveBeenCalledWith("a@b.com", "hunter2");
});

it("disables the button while signing in", async () => {
  let finish: () => void = () => {};
  mockClient.signInWithEmail.mockReturnValue(
    new Promise<client.SignInResult>((resolve) => {
      finish = () => resolve({ kind: "done" });
    })
  );
  await renderGate();
  act(() => emit(null));
  await userEvent.type(await screen.findByLabelText("Email"), "a@b.com");
  await userEvent.type(screen.getByLabelText("Password"), "pw");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  await act(async () => finish());
  expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
});

it("shows a generic error and no dashboard when sign-in fails", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation();
  mockClient.signInWithEmail.mockRejectedValue(
    Object.assign(new Error("boom"), { code: "auth/wrong-password" })
  );
  await renderGate();
  act(() => emit(null));
  await userEvent.type(await screen.findByLabelText("Email"), "a@b.com");
  await userEvent.type(screen.getByLabelText("Password"), "wrong");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(
    await screen.findByText("Incorrect email or password.")
  ).toBeInTheDocument();
  expect(screen.queryByText(/wrong-password|boom/)).not.toBeInTheDocument();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toHaveValue("");
  expect(screen.getByLabelText("Email")).toHaveValue("a@b.com");
  consoleError.mockRestore();
});

it("rejects another account and signs it out", async () => {
  await renderGate();
  act(() => emit({ uid: "someone-else", email: "someone@gmail.com" }));
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(mockClient.signOutUser).toHaveBeenCalled();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  // The sign-out echo must not wipe the explanation.
  act(() => emit(null));
  expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
});

it("still shows the denied message when sign-out rejects", async () => {
  mockClient.signOutUser.mockRejectedValue(new Error("network"));
  await renderGate();
  act(() => emit({ uid: "someone-else", email: "someone@gmail.com" }));
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(mockClient.signOutUser).toHaveBeenCalled();
});

it("rejects the admin email under a different uid", async () => {
  await renderGate();
  act(() => emit({ uid: "impostor", email: "gentry.riggen@gmail.com" }));
  expect(await screen.findByText(/not authorized/i)).toBeInTheDocument();
  expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
});

it("shows the dashboard for the admin and excludes their own traffic", async () => {
  await renderGate();
  act(() => emit({ uid: ADMIN_UID, email: "gentry.riggen@gmail.com" }));
  expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
  expect(window.localStorage.getItem("analytics-exclude")).toBe("1");
});

it("shows the admin email and a sign out button", async () => {
  await renderGate();
  act(() => emit({ uid: ADMIN_UID, email: "gentry.riggen@gmail.com" }));
  expect(
    await screen.findByText("gentry.riggen@gmail.com")
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(mockClient.signOutUser).toHaveBeenCalled();
});

describe("authenticator code", () => {
  async function passwordStep() {
    await renderGate();
    act(() => emit(null));
    await userEvent.type(await screen.findByLabelText("Email"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  }

  it("asks for the code, then shows the dashboard", async () => {
    const finish = jest.fn(async () => {
      emit({ uid: ADMIN_UID, email: "owner@example.test" });
    });
    mockClient.signInWithEmail.mockResolvedValue({ kind: "code", finish });
    await passwordStep();
    const code = await screen.findByLabelText("Code from your authenticator");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("inputmode", "numeric");
    expect(code).toHaveAttribute("maxlength", "6");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(finish).toHaveBeenCalledWith("123456");
    expect(await screen.findByTestId("dashboard")).toBeInTheDocument();
  });

  it("says when the code is wrong and lets it be tried again", async () => {
    const finish = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("bad"), {
          code: "auth/invalid-verification-code",
        })
      )
      .mockResolvedValueOnce(undefined);
    mockClient.signInWithEmail.mockResolvedValue({ kind: "code", finish });
    await passwordStep();
    const code = await screen.findByLabelText("Code from your authenticator");
    await userEvent.type(code, "000000");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(
      await screen.findByText("That code didn't work. Try the newest one.")
    ).toBeInTheDocument();
    expect(code).toHaveValue("");
    await userEvent.type(code, "654321");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(finish).toHaveBeenLastCalledWith("654321");
  });

  it("goes back to the password when the code step fails otherwise", async () => {
    const finish = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("late"), { code: "auth/code-expired" })
      );
    mockClient.signInWithEmail.mockResolvedValue({ kind: "code", finish });
    await passwordStep();
    await userEvent.type(
      await screen.findByLabelText("Code from your authenticator"),
      "123456"
    );
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByText("That didn't work. Sign in again.")
    ).toBeInTheDocument();
  });
});

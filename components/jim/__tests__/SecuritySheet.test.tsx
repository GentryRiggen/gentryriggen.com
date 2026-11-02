import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SecuritySheet from "../SecuritySheet";
import { JimError } from "@/lib/jim/api";
import type { TwoStep } from "@/lib/jim/twoStep";

const API = "https://jim.example.test";
const SECRET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const URL_ = `otpauth://totp/Jim:someone%40example.com?secret=${SECRET}&issuer=Jim`;
const getToken = jest.fn().mockResolvedValue("t");

function codeError(code: string) {
  return Object.assign(new Error(code), { code });
}

interface Setup {
  enrolled?: boolean;
  startTotp?: TwoStep["startTotp"];
  finish?: jest.Mock;
  revoke?: jest.Mock;
  email?: string | null;
}

function renderSheet(setup: Setup = {}) {
  const finish = setup.finish ?? jest.fn().mockResolvedValue(undefined);
  const startTotp =
    setup.startTotp ??
    jest.fn().mockResolvedValue({ secret: SECRET, url: URL_, finish });
  const twoStep: TwoStep = {
    secondFactor: jest.fn().mockResolvedValue({
      enrolled: setup.enrolled ?? false,
      thisSession: setup.enrolled ?? false,
    }),
    startTotp,
    ...(setup.email !== undefined
      ? { accountEmail: jest.fn().mockResolvedValue(setup.email) }
      : {}),
  };
  const revoke = setup.revoke ?? jest.fn().mockResolvedValue(undefined);
  const onClose = jest.fn();
  const onSignedOutEverywhere = jest.fn();
  const view = render(
    <SecuritySheet
      open
      onClose={onClose}
      onSignedOutEverywhere={onSignedOutEverywhere}
      getToken={getToken}
      api={API}
      twoStep={twoStep}
      revoke={revoke}
    />
  );
  return {
    ...view,
    twoStep,
    startTotp,
    finish,
    revoke,
    onClose,
    onSignedOutEverywhere,
  };
}

async function startSetup(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Two-step sign-in is off.");
  await user.click(screen.getByRole("button", { name: "Turn on" }));
  await user.type(screen.getByLabelText("Confirm your password"), "pw");
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SecuritySheet", () => {
  it("is a labelled dialog that says two-step is on", async () => {
    renderSheet({ enrolled: true });
    expect(
      screen.getByRole("dialog", { name: "Sign-in & security" })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Two-step sign-in is on.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Turn on" })
    ).not.toBeInTheDocument();
  });

  it("turns two-step on: password, the link, the grouped key, a QR, the code", async () => {
    const user = userEvent.setup();
    const { startTotp, finish } = renderSheet();
    await startSetup(user);
    expect(startTotp).toHaveBeenCalledWith("pw");

    const link = await screen.findByRole("link", { name: "Add to Passwords" });
    expect(link).toHaveAttribute("href", URL_);
    expect(
      screen.getByText("ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567")
    ).toBeInTheDocument();
    // Drawn here, as SVG: never an image from elsewhere.
    const qr = screen.getByRole("img", { name: /QR code/ });
    expect(qr.tagName.toLowerCase()).toBe("svg");
    expect(document.querySelector("img")).toBeNull();

    const code = screen.getByLabelText("6-digit code");
    expect(code).toHaveAttribute("autocomplete", "one-time-code");
    expect(code).toHaveAttribute("inputmode", "numeric");
    await user.type(code, "123456");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(finish).toHaveBeenCalledWith("123456");
    expect(
      await screen.findByText(
        "Two-step sign-in is on. Jim asks for a code only when you sign in on a new device."
      )
    ).toBeInTheDocument();
    // The secret is gone from the page once enrolled.
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(document.body.innerHTML).not.toContain("ABCD EFGH");
    expect(screen.queryByRole("link", { name: "Add to Passwords" })).toBeNull();
  });

  it("a wrong code keeps the setup and asks for the newest one", async () => {
    const user = userEvent.setup();
    const finish = jest
      .fn()
      .mockRejectedValueOnce(codeError("auth/invalid-verification-code"))
      .mockResolvedValueOnce(undefined);
    renderSheet({ finish });
    await startSetup(user);
    const code = await screen.findByLabelText("6-digit code");
    await user.type(code, "000000");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(
      await screen.findByText("That code didn't work. Try the newest one.")
    ).toBeInTheDocument();
    expect(code).toHaveValue("");
    await user.type(code, "123456");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(finish).toHaveBeenLastCalledWith("123456");
    expect(
      await screen.findByText(/Two-step sign-in is on\. Jim asks/)
    ).toBeInTheDocument();
  });

  it.each([
    "auth/wrong-password",
    "auth/invalid-credential",
    "auth/requires-recent-login",
  ])("%s: says the password didn't work and asks again", async (errCode) => {
    const user = userEvent.setup();
    const startTotp = jest.fn().mockRejectedValue(codeError(errCode));
    renderSheet({ startTotp });
    await startSetup(user);
    expect(
      await screen.findByText("That password didn't work.")
    ).toBeInTheDocument();
    const field = screen.getByLabelText("Confirm your password");
    expect(field).toHaveValue("");
    expect(field).toHaveFocus();
  });

  it("a stale sign-in while finishing asks for the password again, inline", async () => {
    const user = userEvent.setup();
    const finish = jest
      .fn()
      .mockRejectedValue(codeError("auth/requires-recent-login"));
    renderSheet({ finish });
    await startSetup(user);
    await user.type(await screen.findByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(
      await screen.findByText("Confirm your password again to finish.")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm your password")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it("copies the setup key without the spaces", async () => {
    const user = userEvent.setup();
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderSheet();
    await startSetup(user);
    await user.click(await screen.findByRole("button", { name: "Copy key" }));
    expect(writeText).toHaveBeenCalledWith(SECRET);
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
  });

  it("closing drops the secret", async () => {
    const user = userEvent.setup();
    const { rerender, twoStep, revoke, onClose, onSignedOutEverywhere } =
      renderSheet();
    await startSetup(user);
    await screen.findByRole("link", { name: "Add to Passwords" });
    const props = {
      onClose,
      onSignedOutEverywhere,
      getToken,
      api: API,
      twoStep,
      revoke,
    };
    rerender(<SecuritySheet open={false} {...props} />);
    rerender(<SecuritySheet open {...props} />);
    expect(
      await screen.findByText("Two-step sign-in is off.")
    ).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(SECRET);
  });

  it("test_sign_out_everywhere_wipes: confirm, revoke, then the wipe, in that order", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    let release: () => void = () => {};
    const revoke = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          order.push("revoke");
          release = resolve;
        })
    );
    const { onSignedOutEverywhere } = renderSheet({ revoke });
    onSignedOutEverywhere.mockImplementation(() => order.push("wipe"));
    await user.click(
      screen.getByRole("button", { name: "Sign out everywhere" })
    );
    expect(
      screen.getByText("This signs out every device, this one too.")
    ).toBeInTheDocument();
    expect(revoke).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Yes, sign out everywhere" })
    );
    expect(revoke).toHaveBeenCalledWith(getToken, undefined, API);
    expect(onSignedOutEverywhere).not.toHaveBeenCalled();
    await act(async () => release());
    await waitFor(() => expect(order).toEqual(["revoke", "wipe"]));
  });

  it("a 503 keeps him signed in and shows the message", async () => {
    const user = userEvent.setup();
    const revoke = jest.fn().mockRejectedValue(new JimError("waking"));
    const { onSignedOutEverywhere } = renderSheet({ revoke });
    await user.click(
      screen.getByRole("button", { name: "Sign out everywhere" })
    );
    await user.click(
      screen.getByRole("button", { name: "Yes, sign out everywhere" })
    );
    expect(
      await screen.findByText(
        "Couldn't sign out everywhere. Try again in a minute."
      )
    ).toBeInTheDocument();
    expect(onSignedOutEverywhere).not.toHaveBeenCalled();
  });

  it("a refused sign-in leaves the ending to the session (no second wipe)", async () => {
    const user = userEvent.setup();
    const revoke = jest.fn().mockRejectedValue(new JimError("denied"));
    const { onSignedOutEverywhere } = renderSheet({ revoke });
    await user.click(
      screen.getByRole("button", { name: "Sign out everywhere" })
    );
    await user.click(
      screen.getByRole("button", { name: "Yes, sign out everywhere" })
    );
    await waitFor(() => expect(revoke).toHaveBeenCalled());
    expect(onSignedOutEverywhere).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Couldn't sign out everywhere. Try again in a minute.")
    ).toBeNull();
  });

  it("cancel backs out of the confirm", async () => {
    const user = userEvent.setup();
    const { revoke } = renderSheet();
    await user.click(
      screen.getByRole("button", { name: "Sign out everywhere" })
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByText("This signs out every device, this one too.")
    ).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("Back waits while the code is checked", async () => {
    const user = userEvent.setup();
    let settle: () => void = () => {};
    const finish = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        })
    );
    renderSheet({ finish });
    await startSetup(user);
    await user.type(await screen.findByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    await act(async () => settle());
    expect(
      await screen.findByText(/Two-step sign-in is on\. Jim asks/)
    ).toBeInTheDocument();
  });

  it("can't be closed while signing out everywhere", async () => {
    const user = userEvent.setup();
    let fail: (err: unknown) => void = () => {};
    const revoke = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        })
    );
    const { onClose } = renderSheet({ revoke });
    await user.click(
      screen.getByRole("button", { name: "Sign out everywhere" })
    );
    await user.click(
      screen.getByRole("button", { name: "Yes, sign out everywhere" })
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    await user.keyboard("{Escape}");
    const backdrop = document.querySelector('[aria-hidden="true"].absolute');
    await user.click(backdrop as Element);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => fail(new JimError("waking")));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("names the account for password managers on the password step", async () => {
    const user = userEvent.setup();
    renderSheet({ email: "someone@example.com" });
    await screen.findByText("Two-step sign-in is off.");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    const username = await waitFor(() => {
      const found = document.querySelector<HTMLInputElement>(
        'input[autocomplete="username"]'
      );
      expect(found).not.toBeNull();
      return found as HTMLInputElement;
    });
    await waitFor(() => expect(username.value).toBe("someone@example.com"));
    expect(username).not.toBeVisible();
    expect(username.form).toBe(
      screen.getByLabelText("Confirm your password").closest("form")
    );
  });

  it("warns that a new key replaces the old one when the password is asked again", async () => {
    const user = userEvent.setup();
    const finish = jest
      .fn()
      .mockRejectedValue(codeError("auth/requires-recent-login"));
    renderSheet({ finish });
    await startSetup(user);
    // The first time, no warning: there is no earlier key.
    expect(screen.queryByText(/replaces the one you saved/)).toBeNull();
    await user.type(await screen.findByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Turn on" }));
    expect(
      await screen.findByText(
        "Continuing makes a new setup key that replaces the one you saved. Delete the earlier Jim entry in Passwords (or your authenticator app)."
      )
    ).toBeInTheDocument();
  });

  it("Escape closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

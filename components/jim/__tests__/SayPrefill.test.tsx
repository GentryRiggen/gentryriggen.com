import { render, screen } from "@testing-library/react";
import JimChat from "../JimChat";

jest.mock("../notes/NotesShell", () => ({
  __esModule: true,
  default: () => null,
}));

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

beforeEach(() => window.localStorage.clear());
afterEach(() => window.history.replaceState(null, "", "/"));

it("puts an allowed ?say= in the box, unsent, and removes it from the URL", () => {
  window.history.replaceState(null, "", "/jim?say=quiz%20me");
  renderChat();
  expect(screen.getByLabelText("Message")).toHaveValue("quiz me");
  expect(window.location.search).toBe("");
  expect(screen.queryByRole("log")?.textContent).not.toContain("quiz me");
});

it("ignores a ?say= that is not on the list", () => {
  window.history.replaceState(null, "", "/jim?say=wipe%20my%20notes");
  renderChat();
  expect(screen.getByLabelText("Message")).toHaveValue("");
  expect(window.location.search).toBe("");
});

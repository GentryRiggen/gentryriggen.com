import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "@/lib/jim/api";
import * as view from "@/lib/jim/view";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import NotesShell from "../NotesShell";

jest.mock("@/lib/jim/view", () => {
  const actual = jest.requireActual("@/lib/jim/view");
  return { ...actual, fetchView: jest.fn() };
});

const fetchView = jest.mocked(view.fetchView);
const getToken = jest.fn().mockResolvedValue("t");

/** fetchView that also fills the cache, like the real one. */
function resolvesWith(data: view.ViewData) {
  return async () => {
    const real = jest.requireActual("@/lib/jim/view") as typeof view;
    await real.fetchView(
      async () => "t",
      (async () =>
        ({
          status: 200,
          ok: true,
          json: async () => data,
        }) as Response) as typeof fetch,
      "https://jim.example.test"
    );
    return data;
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (err: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderShell(active = true) {
  return render(
    <NotesShell
      api="https://jim.example.test"
      getToken={getToken}
      active={active}
      onDone={jest.fn()}
    />
  );
}

beforeEach(() => {
  fetchView.mockReset();
  (jest.requireActual("@/lib/jim/view") as typeof view).clearViewCache();
});

it("shows a skeleton, then Home", async () => {
  const pending = deferred<view.ViewData>();
  fetchView.mockReturnValue(pending.promise);
  renderShell();
  expect(screen.getByText("Loading notes…")).toBeInTheDocument();
  await act(async () => pending.resolve(VIEW_FIXTURE));
  expect(screen.getByText("Water the plants")).toBeInTheDocument();
  expect(screen.queryByText("Loading notes…")).not.toBeInTheDocument();
  const [token, fetchFn, url] = fetchView.mock.calls[0];
  expect(token).toBe(getToken);
  expect(fetchFn).toBeUndefined();
  expect(url).toBe("https://jim.example.test");
});

it("does not fetch until the tab is opened", () => {
  renderShell(false);
  expect(fetchView).not.toHaveBeenCalled();
});

it("shows the cached payload at once on the next open", async () => {
  fetchView.mockImplementation(resolvesWith(VIEW_FIXTURE));
  const first = renderShell();
  await screen.findByText("Water the plants");
  first.unmount();

  fetchView.mockReset();
  fetchView.mockReturnValue(new Promise(() => {}));
  renderShell();
  // Straight from the cache, no skeleton, and no refetch while it's fresh.
  expect(screen.getByText("Water the plants")).toBeInTheDocument();
  expect(screen.queryByText("Loading notes…")).not.toBeInTheDocument();
  expect(fetchView).not.toHaveBeenCalled();
});

it("refreshes on request and keeps showing the old data meanwhile", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  const pending = deferred<view.ViewData>();
  fetchView.mockReturnValueOnce(pending.promise);
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(screen.getByText("Water the plants")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  await act(async () =>
    pending.resolve({
      ...VIEW_FIXTURE,
      todos: VIEW_FIXTURE.todos.slice(0, 1),
    })
  );
  expect(screen.queryByText("Water the plants")).not.toBeInTheDocument();
});

it("keeps the data and says so quietly when a refresh fails", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  fetchView.mockRejectedValueOnce(new api.JimError("waking"));
  await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(
    await screen.findByText(/Couldn't refresh\. Showing what loaded/)
  ).toBeInTheDocument();
  expect(screen.getByText("Water the plants")).toBeInTheDocument();
});

it("offers Try again when the first load fails", async () => {
  fetchView.mockRejectedValueOnce(new api.JimError("waking"));
  renderShell();
  expect(
    await screen.findByText("Jim is waking up. Try again in a moment.")
  ).toBeInTheDocument();
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Water the plants")).toBeInTheDocument();
});

it("asks to sign in again when the server refuses the token", async () => {
  fetchView.mockRejectedValueOnce(new api.JimError("denied"));
  renderShell();
  expect(
    await screen.findByText(
      "Jim didn't accept your sign-in. Sign out and back in."
    )
  ).toBeInTheDocument();
});

it("says quietly when the notes may be behind", async () => {
  fetchView.mockResolvedValueOnce({ ...VIEW_FIXTURE, stale: true });
  renderShell();
  expect(
    await screen.findByText(/Jim couldn't sync, so these may be behind/)
  ).toBeInTheDocument();
});

it("moves between pages and into a profile and back", async () => {
  fetchView.mockResolvedValueOnce(VIEW_FIXTURE);
  renderShell();
  await screen.findByText("Water the plants");
  await userEvent.click(screen.getByRole("tab", { name: "Golf" }));
  expect(screen.getByRole("tab", { name: "Golf" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(screen.getByRole("region", { name: "Rounds" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "People" }));
  await userEvent.type(screen.getByLabelText("Search people"), "sam");
  await userEvent.click(screen.getByRole("button", { name: /Sam Okafor/ }));
  expect(
    screen.getByRole("heading", { name: "Sam Okafor" })
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "People" }));
  // The search is kept.
  expect(screen.getByLabelText("Search people")).toHaveValue("sam");
  // Tapping People again from a profile also returns to the list.
  await userEvent.click(screen.getByRole("button", { name: /Sam Okafor/ }));
  await userEvent.click(screen.getByRole("tab", { name: "People" }));
  expect(screen.getByLabelText("Search people")).toBeInTheDocument();
});

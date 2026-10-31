import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as view from "@/lib/jim/view";
import { VIEW_FIXTURE } from "@/lib/jim/__tests__/fixtures";
import NotesHome from "../NotesHome";

jest.mock("@/lib/jim/view", () => {
  const actual = jest.requireActual("@/lib/jim/view");
  return { ...actual, toggleTodo: jest.fn() };
});

const toggleTodo = jest.mocked(view.toggleTodo);
const API = "https://jim.example.test";
const getToken = jest.fn().mockResolvedValue("t");
const PLANTS = VIEW_FIXTURE.todos.find((t) => t.order === 3)!;

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** The payload after the save: the line now carries its done stamp. */
const AFTER: view.ViewData = {
  ...VIEW_FIXTURE,
  todos: VIEW_FIXTURE.todos.filter((t) => t.order !== 3),
  doneTodos: [
    {
      ...PLANTS,
      text: `${PLANTS.text} (done 2026-10-31)`,
      done: true,
      done_on: "2026-10-31",
    },
  ],
};

function renderHome(
  onChanged = jest.fn<Promise<view.ViewData | null>, []>(async () => AFTER)
) {
  render(
    <NotesHome
      data={VIEW_FIXTURE}
      api={API}
      getToken={getToken}
      onChanged={onChanged}
      onLog={jest.fn()}
    />
  );
  return onChanged;
}

function box(name = "Water the plants") {
  return screen.getByRole("checkbox", { name });
}

beforeEach(() => {
  toggleTodo.mockReset();
  jest.useRealTimers();
});

it("gives every open todo an unchecked box and no Done button", () => {
  renderHome();
  expect(box()).toHaveAttribute("aria-checked", "false");
  expect(screen.queryByRole("button", { name: /^Done/ })).toBeNull();
});

it("checks at once, shows it saving, then offers Undo and refetches", async () => {
  const pending = deferred<view.TodoResult>();
  toggleTodo.mockReturnValue(pending.promise);
  const onChanged = renderHome();
  await userEvent.click(box());
  expect(box()).toHaveAttribute("aria-checked", "true");
  expect(box()).toHaveAttribute("aria-busy", "true");
  expect(toggleTodo).toHaveBeenCalledWith(
    PLANTS,
    true,
    getToken,
    undefined,
    API
  );
  // A second tap while it saves does nothing.
  await userEvent.click(box());
  expect(toggleTodo).toHaveBeenCalledTimes(1);

  await act(async () => pending.resolve({ ok: true, sha: "abc1235" }));
  expect(box()).toHaveAttribute("aria-checked", "true");
  expect(box()).not.toHaveAttribute("aria-busy", "true");
  const toast = screen.getByRole("status");
  expect(within(toast).getByText("Done")).toBeInTheDocument();
  expect(onChanged).toHaveBeenCalledTimes(1);
});

it("Undo unchecks the line as the refetch shows it (with its done stamp)", async () => {
  toggleTodo.mockResolvedValue({ ok: true, sha: "s" });
  const onChanged = renderHome();
  await userEvent.click(box());
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
  await act(async () => {});
  expect(toggleTodo).toHaveBeenLastCalledWith(
    AFTER.doneTodos[0],
    false,
    getToken,
    undefined,
    API
  );
  expect(box()).toHaveAttribute("aria-checked", "false");
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(onChanged).toHaveBeenCalledTimes(2);
});

it("an Undo tapped before the refetch lands waits for it", async () => {
  toggleTodo.mockResolvedValue({ ok: true, sha: "s" });
  const refetch = deferred<view.ViewData | null>();
  renderHome(jest.fn(() => refetch.promise));
  await userEvent.click(box());
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
  expect(toggleTodo).toHaveBeenCalledTimes(1);
  expect(box()).toHaveAttribute("aria-busy", "true");
  await act(async () => refetch.resolve(AFTER));
  expect(toggleTodo).toHaveBeenCalledTimes(2);
  expect(toggleTodo.mock.calls[1][0].text).toMatch(/\(done 2026-10-31\)$/);
});

it("an Undo whose line is gone after the refetch reverts and says it changed", async () => {
  toggleTodo.mockResolvedValue({ ok: true, sha: "s" });
  const onChanged = renderHome(
    jest.fn(async () => ({ ...AFTER, doneTodos: [] }))
  );
  await userEvent.click(box());
  await userEvent.click(await screen.findByRole("button", { name: "Undo" }));
  expect(
    await screen.findByText("That todo changed. Pull to refresh.")
  ).toBeInTheDocument();
  expect(toggleTodo).toHaveBeenCalledTimes(1);
  expect(onChanged).toHaveBeenCalledTimes(2);
});

it("the Undo toast goes after 5 seconds", async () => {
  jest.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  toggleTodo.mockResolvedValue({ ok: true, sha: "s" });
  renderHome();
  await user.click(box());
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(4900);
  });
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

it("reverts and says why when the todo changed on the Mac (409), then refetches", async () => {
  toggleTodo.mockResolvedValue({
    ok: false,
    reason: "changed",
    message: "That todo changed. Pull to refresh.",
  });
  const onChanged = renderHome();
  await userEvent.click(box());
  expect(
    await screen.findByText("That todo changed. Pull to refresh.")
  ).toBeInTheDocument();
  expect(box()).toHaveAttribute("aria-checked", "false");
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  expect(onChanged).toHaveBeenCalledTimes(1);
});

it("reverts with Couldn't save when the server is busy or gone", async () => {
  toggleTodo.mockResolvedValue({
    ok: false,
    reason: "failed",
    message: "Couldn't save. Try again.",
  });
  renderHome();
  await userEvent.click(box());
  expect(
    await screen.findByText("Couldn't save. Try again.")
  ).toBeInTheDocument();
  expect(box()).toHaveAttribute("aria-checked", "false");
});

it("sends a second todo's tap only once the first settles", async () => {
  const first = deferred<view.TodoResult>();
  toggleTodo
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ ok: true, sha: "s" });
  renderHome();
  await userEvent.click(box());
  await userEvent.click(box("Renew the car registration"));
  // Both boxes show at once; only one request is out.
  expect(box("Renew the car registration")).toHaveAttribute(
    "aria-checked",
    "true"
  );
  expect(toggleTodo).toHaveBeenCalledTimes(1);
  await act(async () => first.resolve({ ok: true, sha: "s" }));
  expect(toggleTodo).toHaveBeenCalledTimes(2);
  expect(toggleTodo.mock.calls[1][0].text).toMatch(/^Renew the car/);
});

it("drops a finished check once fresh data arrives", async () => {
  toggleTodo.mockResolvedValue({ ok: true, sha: "s" });
  const { rerender } = render(
    <NotesHome
      data={VIEW_FIXTURE}
      api={API}
      getToken={getToken}
      onChanged={jest.fn(async () => null)}
      onLog={jest.fn()}
    />
  );
  await userEvent.click(box());
  rerender(
    <NotesHome
      data={{
        ...VIEW_FIXTURE,
        todos: VIEW_FIXTURE.todos.filter((t) => t.order !== 3),
      }}
      api={API}
      getToken={getToken}
      onChanged={jest.fn(async () => null)}
      onLog={jest.fn()}
    />
  );
  expect(
    screen.queryByRole("checkbox", { name: "Water the plants" })
  ).toBeNull();
  // The Undo stays offered for the rest of its 5 seconds.
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
});

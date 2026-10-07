import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../Dashboard";
import * as client from "@/lib/firebase/client";
import type { PageviewDoc } from "@/lib/analytics/types";

jest.mock("@/lib/firebase/client");
jest.mock("../VisitorMap", () => ({
  __esModule: true,
  default: () => <div data-testid="map" />,
}));

const mockClient = jest.mocked(client);

function view(overrides: Partial<PageviewDoc>): PageviewDoc {
  return {
    ts: new Date(),
    site: "home",
    path: "/",
    ref: "",
    device: "desktop",
    browser: "Chrome",
    os: "macOS",
    screen: "1440+",
    tz: "America/Denver",
    vid: "a",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.fetchPageviews.mockResolvedValue({
    docs: [
      view({ vid: "a" }),
      view({ vid: "b", path: "/ship-builder", site: "ship-builder" }),
      view({ vid: "c", path: "/ship-builder/versions", site: "ship-builder" }),
    ],
    truncated: false,
  });
});

it("loads data and shows the overview totals", async () => {
  render(<Dashboard />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  const views = await screen.findByTestId("stat-views");
  expect(within(views).getByText("3")).toBeInTheDocument();
  expect(screen.getByTestId("map")).toBeInTheDocument();
});

it("switches scope with the tabs", async () => {
  render(<Dashboard />);
  await screen.findByTestId("stat-views");
  await userEvent.click(screen.getByRole("tab", { name: "Ship Builder" }));
  expect(
    within(screen.getByTestId("stat-views")).getByText("2")
  ).toBeInTheDocument();
  expect(screen.getByText("/ship-builder/versions")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Home (/)" }));
  expect(
    within(screen.getByTestId("stat-views")).getByText("1")
  ).toBeInTheDocument();
});

it("refetches when the range changes", async () => {
  render(<Dashboard />);
  await screen.findByTestId("stat-views");
  expect(mockClient.fetchPageviews).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "30 days" }));
  await waitFor(() =>
    expect(mockClient.fetchPageviews).toHaveBeenCalledTimes(2)
  );
});

describe("when loading fails", () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it("shows the Firebase error code and logs the error", async () => {
    const failure = Object.assign(
      new Error("Missing or insufficient permissions."),
      {
        code: "permission-denied",
      }
    );
    mockClient.fetchPageviews.mockRejectedValue(failure);
    render(<Dashboard />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      /couldn.t load analytics \(permission-denied\)/i
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load analytics",
      failure
    );
  });

  it("falls back to the message, then to a generic reason", async () => {
    mockClient.fetchPageviews.mockRejectedValueOnce(new Error("network down"));
    const { unmount } = render(<Dashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "(network down)"
    );
    unmount();
    mockClient.fetchPageviews.mockRejectedValueOnce("boom");
    render(<Dashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "(unknown error)"
    );
  });
});

it("warns when the data was truncated and hides the change figures", async () => {
  mockClient.fetchPageviews.mockResolvedValue({
    docs: [view({ vid: "a" })],
    truncated: true,
  });
  render(<Dashboard />);
  expect(
    await screen.findByText(/older views are missing/i)
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId("stat-views")).getByText(/change unavailable/i)
  ).toBeInTheDocument();
  expect(screen.queryByText(/vs previous period/i)).not.toBeInTheDocument();
});

it("shows the change figures when the data is complete", async () => {
  render(<Dashboard />);
  const views = await screen.findByTestId("stat-views");
  expect(within(views).queryByText(/change unavailable/i)).toBeNull();
});

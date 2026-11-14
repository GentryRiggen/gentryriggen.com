import { render, waitFor } from "@testing-library/react";
import AnalyticsTracker from "../AnalyticsTracker";
import { buildPageview } from "@/lib/analytics/event";

let pathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
jest.mock("@/lib/analytics/event");

// The sender (and the App Check it brings) loads only when a view is sent,
// so a page that is never tracked (Jim) never downloads it.
const mockSend = jest.fn();
const mockSendLoaded = jest.fn();
jest.mock("@/lib/analytics/send", () => {
  mockSendLoaded();
  return { sendPageview: (...args: unknown[]) => mockSend(...args) };
});

const mockBuild = jest.mocked(buildPageview);
const fakeEvent = { site: "home" } as ReturnType<typeof buildPageview>;

beforeEach(() => {
  mockBuild.mockReset();
  mockSend.mockReset();
  pathname = "/";
  mockBuild.mockReturnValue(fakeEvent);
  mockSend.mockResolvedValue(true);
});

it("sends nothing and loads no sender when the view should not be tracked", async () => {
  mockBuild.mockReturnValue(null);
  render(<AnalyticsTracker />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(mockSend).not.toHaveBeenCalled();
  expect(mockSendLoaded).not.toHaveBeenCalled();
});

it("sends a view on mount and renders nothing", async () => {
  const { container } = render(<AnalyticsTracker />);
  expect(container).toBeEmptyDOMElement();
  expect(mockBuild).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/", firstView: true })
  );
  await waitFor(() => expect(mockSend).toHaveBeenCalledWith(fakeEvent));
});

it("sends another view on navigation, no longer first", async () => {
  const { rerender } = render(<AnalyticsTracker />);
  pathname = "/ship-builder";
  rerender(<AnalyticsTracker />);
  expect(mockBuild).toHaveBeenLastCalledWith(
    expect.objectContaining({ pathname: "/ship-builder", firstView: false })
  );
  await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(2));
});

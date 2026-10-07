import { render } from "@testing-library/react";
import AnalyticsTracker from "../AnalyticsTracker";
import { buildPageview } from "@/lib/analytics/event";
import { sendPageview } from "@/lib/analytics/send";

let pathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
jest.mock("@/lib/analytics/event");
jest.mock("@/lib/analytics/send");

const mockBuild = jest.mocked(buildPageview);
const mockSend = jest.mocked(sendPageview);
const fakeEvent = { site: "home" } as ReturnType<typeof buildPageview>;

beforeEach(() => {
  jest.clearAllMocks();
  pathname = "/";
  mockBuild.mockReturnValue(fakeEvent);
  mockSend.mockResolvedValue(true);
});

it("sends a view on mount and renders nothing", () => {
  const { container } = render(<AnalyticsTracker />);
  expect(container).toBeEmptyDOMElement();
  expect(mockBuild).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/", firstView: true })
  );
  expect(mockSend).toHaveBeenCalledWith(fakeEvent);
});

it("sends another view on navigation, no longer first", () => {
  const { rerender } = render(<AnalyticsTracker />);
  pathname = "/ship-builder";
  rerender(<AnalyticsTracker />);
  expect(mockBuild).toHaveBeenLastCalledWith(
    expect.objectContaining({ pathname: "/ship-builder", firstView: false })
  );
  expect(mockSend).toHaveBeenCalledTimes(2);
});

it("sends nothing when the view should not be tracked", () => {
  mockBuild.mockReturnValue(null);
  render(<AnalyticsTracker />);
  expect(mockSend).not.toHaveBeenCalled();
});

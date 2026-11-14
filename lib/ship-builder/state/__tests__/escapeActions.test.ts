import {
  requestBoard,
  requestClimbIn,
  takeEscapeRequest,
} from "../escapeActions";

describe("escapeActions", () => {
  it("hands the runner one request, once", () => {
    expect(takeEscapeRequest()).toBeNull();
    requestBoard();
    expect(takeEscapeRequest()).toBe("board");
    expect(takeEscapeRequest()).toBeNull();
    requestBoard();
    requestClimbIn();
    expect(takeEscapeRequest()).toBe("climb-in");
  });
});

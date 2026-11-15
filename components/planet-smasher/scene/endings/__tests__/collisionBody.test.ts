import { collisionBody } from "../collisionBody";

describe("collisionBody", () => {
  it("sends Mars at Earth", () => {
    expect(collisionBody("earth")).toBe("mars");
  });

  it("sends Earth at everyone else", () => {
    expect(collisionBody("mars")).toBe("earth");
    expect(collisionBody("ice")).toBe("earth");
  });
});

import { secondFactor, startTotp } from "../auth";
import { jimTwoStep } from "../twoStep";

jest.mock("../auth", () => ({
  secondFactor: jest.fn(),
  startTotp: jest.fn(),
}));

const CONFIG = {
  enrolled: false,
  password: "invented-pw",
  secret: "ABCDEFGHIJKLMNOP",
  code: "654321",
};

afterEach(() => {
  delete window.__JIM_TEST__;
});

describe("jimTwoStep", () => {
  it("is Jim's own sign-in without the test hook", () => {
    const got = jimTwoStep();
    expect(got.secondFactor).toBe(secondFactor);
    expect(got.startTotp).toBe(startTotp);
  });

  it("needs a signed-in hook before it stands in", () => {
    window.__JIM_TEST__ = { twoStep: CONFIG };
    expect(jimTwoStep().startTotp).toBe(startTotp);
  });

  it("the stand-in checks the password and the code, then reports enrolled", async () => {
    window.__JIM_TEST__ = { signedIn: true, twoStep: CONFIG };
    const two = jimTwoStep();
    expect(two.startTotp).not.toBe(startTotp);
    await expect(two.secondFactor()).resolves.toEqual({
      enrolled: false,
      thisSession: false,
    });
    await expect(two.startTotp("nope")).rejects.toMatchObject({
      code: "auth/wrong-password",
    });
    const setup = await two.startTotp("invented-pw");
    expect(setup.secret).toBe(CONFIG.secret);
    expect(setup.url).toContain(`secret=${CONFIG.secret}`);
    await expect(setup.finish("000000")).rejects.toMatchObject({
      code: "auth/invalid-verification-code",
    });
    await setup.finish("654321");
    await expect(two.secondFactor()).resolves.toMatchObject({ enrolled: true });
  });
});

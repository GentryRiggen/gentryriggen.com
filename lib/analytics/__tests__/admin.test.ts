import { ADMIN_UID, isAdminUser } from "../admin";

describe("isAdminUser", () => {
  it("accepts the admin uid", () => {
    expect(
      isAdminUser({ uid: ADMIN_UID, email: "gentry.riggen@gmail.com" })
    ).toBe(true);
    expect(isAdminUser({ uid: ADMIN_UID, email: null })).toBe(true);
  });

  it("rejects another uid, even with the admin email", () => {
    expect(
      isAdminUser({ uid: "someone-else", email: "gentry.riggen@gmail.com" })
    ).toBe(false);
  });

  it("rejects null", () => {
    expect(isAdminUser(null)).toBe(false);
  });
});

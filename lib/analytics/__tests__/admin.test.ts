import { ADMIN_EMAIL, isAdminUser } from "../admin";

describe("isAdminUser", () => {
  it("accepts only the verified admin email", () => {
    expect(isAdminUser({ email: ADMIN_EMAIL, emailVerified: true })).toBe(true);
    expect(isAdminUser({ email: ADMIN_EMAIL, emailVerified: false })).toBe(
      false
    );
    expect(isAdminUser({ email: "other@gmail.com", emailVerified: true })).toBe(
      false
    );
    expect(isAdminUser({ email: null, emailVerified: true })).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });

  it("is case-insensitive on the email", () => {
    expect(
      isAdminUser({ email: "Gentry.Riggen@Gmail.com", emailVerified: true })
    ).toBe(true);
  });
});

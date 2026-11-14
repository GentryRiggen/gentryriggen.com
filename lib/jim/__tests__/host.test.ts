import { JIM_HOST, JIM_URL, jimRedirectTarget } from "../host";

const live = { isProduction: true, isE2E: false };

it("points at Jim's own host, the one the server allows", () => {
  expect(JIM_HOST).toBe("jim.gentryriggen.com");
  expect(JIM_URL).toBe("https://jim.gentryriggen.com/jim");
});

it("stays put on jim.gentryriggen.com", () => {
  expect(jimRedirectTarget("jim.gentryriggen.com", live)).toBeNull();
});

it.each([
  "gentryriggen.com",
  "www.gentryriggen.com",
  "gentry.codes",
  "www.gentry.codes",
  "iamsturdy.com",
  "hatemecauseyouaintme.com",
  "jackeddeveloper.com",
  "gentryriggen.web.app",
  "gentryriggen.firebaseapp.com",
  "jim-gentryriggen.web.app",
  "jim-gentryriggen.firebaseapp.com",
])("sends %s to jim.gentryriggen.com/jim", (host) => {
  expect(jimRedirectTarget(host, live)).toBe(
    "https://jim.gentryriggen.com/jim"
  );
});

it.each(["localhost", "127.0.0.1", "[::1]"])(
  "never redirects on %s",
  (host) => {
    expect(jimRedirectTarget(host, live)).toBeNull();
  }
);

it("never redirects in dev or e2e builds", () => {
  expect(
    jimRedirectTarget("gentry.codes", { isProduction: false, isE2E: false })
  ).toBeNull();
  expect(
    jimRedirectTarget("gentry.codes", { isProduction: true, isE2E: true })
  ).toBeNull();
});

import { firebaseConfig, isFirebaseConfigured } from "../config";

describe("isFirebaseConfigured", () => {
  const base = {
    apiKey: "key",
    authDomain: "x.firebaseapp.com",
    projectId: "proj",
    appId: "1:2:web:3",
  };

  it("is true when apiKey and projectId are set", () => {
    expect(isFirebaseConfigured(base)).toBe(true);
  });

  it("is false when apiKey is empty", () => {
    expect(isFirebaseConfigured({ ...base, apiKey: "" })).toBe(false);
  });

  it("is false when projectId is empty", () => {
    expect(isFirebaseConfigured({ ...base, projectId: "" })).toBe(false);
  });
});

describe("committed firebaseConfig", () => {
  it("is configured for the gentryriggen project", () => {
    expect(isFirebaseConfigured()).toBe(true);
    expect(firebaseConfig.projectId).toBe("gentryriggen");
  });
});

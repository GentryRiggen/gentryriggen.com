// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    // three.cjs only re-exports the ES build and warns; load the build directly.
    "^three$": "<rootDir>/node_modules/three/build/three.module.js",
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/e2e/",
    "/.next/",
    "/out/",
    "<rootDir>/.claude/",
    "<rootDir>/firestore-tests/",
  ],
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "components/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/.next/**",
  ],
};

/**
 * three and the react-three packages ship ES modules only (the jsdom
 * environment resolves their "browser"/"import" entries), so Jest must
 * transform them. next/jest always prepends "/node_modules/" to
 * transformIgnorePatterns and a custom config can only append, so the pattern
 * list is replaced after next/jest has resolved the config.
 */
const ESM_PACKAGES = ["three", "@react-three", "three-stdlib", "its-fine"];
const esmTransformIgnorePattern = `/node_modules/(?!(${ESM_PACKAGES.join("|")})/)`;

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();
  return {
    ...config,
    transformIgnorePatterns: [
      esmTransformIgnorePattern,
      ...config.transformIgnorePatterns.filter(
        (p) => !p.startsWith("/node_modules")
      ),
    ],
  };
};

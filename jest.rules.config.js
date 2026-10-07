// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

// Run via `npm run test:rules`; needs the Firestore emulator (Java 21+).
module.exports = createJestConfig({
  testEnvironment: "node",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: ["<rootDir>/firestore-tests/**/*.test.ts"],
  testTimeout: 20000,
});

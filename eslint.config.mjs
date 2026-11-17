import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

/**
 * Browser APIs newer than the oldest iPad we support (Safari 15.0). Shipped
 * code must not use them without a fallback; lib/game-kit/compat.ts has the
 * helpers (hasOwn). Tests, scripts and e2e run in Node and are exempt.
 */
const COMPAT_MESSAGE =
  "is newer than Safari 15.0 (older iPads). Use the lib/game-kit/compat helper or a plain equivalent.";
const compatProperties = [
  ["Object", "hasOwn"],
  ["Object", "groupBy"],
  ["Map", "groupBy"],
  ["Promise", "withResolvers"],
  ["Array", "fromAsync"],
  ["window", "structuredClone"],
].map(([object, property]) => ({
  object,
  property,
  message: `${object}.${property} ${COMPAT_MESSAGE}`,
}));
const compatMethods = [
  "at",
  "findLast",
  "findLastIndex",
  "toSorted",
  "toReversed",
  "toSpliced",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
    ],
    ignores: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-properties": ["error", ...compatProperties],
      "no-restricted-globals": [
        "error",
        {
          name: "structuredClone",
          message: `structuredClone ${COMPAT_MESSAGE}`,
        },
        {
          name: "requestIdleCallback",
          message:
            "requestIdleCallback does not exist in Safari. Use setTimeout.",
        },
        {
          name: "cancelIdleCallback",
          message:
            "cancelIdleCallback does not exist in Safari. Use clearTimeout.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...compatMethods.map((name) => ({
          selector: `CallExpression[callee.type='MemberExpression'][callee.property.name='${name}']`,
          message: `.${name}() ${COMPAT_MESSAGE}`,
        })),
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "out-jim/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;

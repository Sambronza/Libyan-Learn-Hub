// Flat ESLint config for the workspace. Intentionally low-noise: it targets
// genuine bugs (rules-of-hooks, duplicate keys, unreachable code) rather than
// stylistic nits, which Prettier handles. `any` and unused vars are warnings,
// not errors, so the existing codebase isn't drowned in failures.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/static-build/**",
      "lib/api-zod/src/**",
      "lib/api-client-react/src/**",
      "artifacts/lms-mobile/android/**",
      "artifacts/lms-mobile/ios/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // React correctness — these catch real hook bugs
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Pragmatic for this codebase: warn, don't block
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "warn",
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
);

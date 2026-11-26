import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".piclaw/**",
      "vendor/**",
      "lazydsh-ofm-**/",
      "**/lazydsh-ofm-*/**",
    ],
  },
  ...tseslint.config(
    {
      files: ["src/**/*.ts"],
      rules: {
        // Type safety: ban unsafe `any`
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/explicit-module-boundary-types": "warn",
        // Unused
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
        ],
        // Architecture: enforce layering from AGENTS.md
        // runtime/ may only import contracts and utils/ (not interactive-mode/)
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["../interactive-mode/**", "./interactive-mode/**"],
                message:
                  "runtime/ must not import from interactive-mode/ (layering violation: runtime/ may only import contracts and utils/)",
              },
            ],
          },
        ],
        // No console.log in production code paths (allow in scripts/)
        "no-console": ["warn", { allow: ["warn", "error"] }],
      },
    },
    {
      files: ["src/runtime/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["../interactive-mode/**"],
                message: "runtime/ must not import from interactive-mode/ (layering violation)",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["src/utils/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["../runtime/**", "../interactive-mode/**"],
                message:
                  "utils/ must not import from runtime/ or interactive-mode/ (layering violation)",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["scripts/**/*.ts", "test/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
      },
    },
  ),
);

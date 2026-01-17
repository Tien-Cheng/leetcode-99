import baseConfig, { reactConfig } from "@leet99/config/eslint";

export default [
  ...baseConfig,
  ...reactConfig,
  {
    ignores: [".next/**", "node_modules/**"],
  },
];

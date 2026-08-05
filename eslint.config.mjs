// ESLint 9 flat config.
// eslint-config-next v16 ships native flat-config entry points, so we import
// them directly. Do NOT route these through FlatCompat — the eslintrc bridge
// chokes on the plugin object graph ("Converting circular structure to JSON").
import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    // React Compiler's effect heuristics flag legitimate "kick off an async
    // job once on mount" patterns in the boost/setup screens. They are
    // performance advisories, not correctness bugs, so keep them visible as
    // warnings instead of failing the whole lint run.
    files: ["src/app/**/*.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;

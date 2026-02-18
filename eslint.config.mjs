import coreWebVitals from "eslint-config-next/core-web-vitals";

// TODO: Once the Next 16 / React 19 upgrade is stable, revisit and honour these
// rules by refactoring the affected components. They were downgraded from
// "error" to "warn" because this project does not use the React Compiler and
// these are new rules shipped with eslint-plugin-react-hooks v5 that flag
// pre-existing, intentional patterns as errors.
// Rules: react-hooks/set-state-in-effect, react-hooks/refs,
//        react-hooks/purity, react-hooks/static-components,
//        react-hooks/immutability
const reactCompilerRulesToRevisit = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/refs": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/static-components": "warn",
  "react-hooks/immutability": "warn",
};

const eslintConfig = [
  ...coreWebVitals,
  {
    rules: reactCompilerRulesToRevisit,
  },
];

export default eslintConfig;

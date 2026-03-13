import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // Disable explicit 'any' type warning
      "react-hooks/exhaustive-deps": "off", // Disable exhaustive-deps warning
      "no-unused-vars": "off", // Keep 'no-unused-vars' as a warning
      "no-restricted-globals": [
        "error",
        {
          name: "confirm",
          message:
            "Use the shared ConfirmModal UI instead of browser-native confirm dialogs.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "confirm",
          message:
            "Use the shared ConfirmModal UI instead of browser-native window.confirm.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            "Use the shared Dropdown component instead of native <select> to keep UI consistent.",
        },
      ],
    },
  },
];

export default eslintConfig;

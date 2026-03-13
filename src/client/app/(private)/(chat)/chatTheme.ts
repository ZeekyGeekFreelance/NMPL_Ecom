// src/components/chat/utils/chatTheme.ts

// Define consistent theme values for the chat components
export const chatTheme = {
  colors: {
    primary: {
      light: "#b3c0d9", // --color-primary-muted
      default: "#1d3461", // --color-primary
      dark: "#152847", // --color-primary-hover
    },
    secondary: {
      light: "#dde2e9", // --color-border
      default: "#b0bbc8", // --color-border-dark
      dark: "#6b7280", // --color-text-subtle
    },
    background: {
      light: "#ffffff", // --color-surface
      default: "#f9fafb", // --color-surface-alt
      dark: "#f4f5f7", // --color-background
    },
    text: {
      light: "#6b7280", // --color-text-subtle
      default: "#4b5563", // --color-text-muted
      dark: "#1c2533", // --color-text
    },
    success: {
      default: "#15803d", // --color-success
    },
    error: {
      default: "#b91c1c", // --color-error
    },
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  borderRadius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  },
  animation: {
    fast: "150ms",
    default: "300ms",
    slow: "500ms",
  },
};

export default chatTheme;

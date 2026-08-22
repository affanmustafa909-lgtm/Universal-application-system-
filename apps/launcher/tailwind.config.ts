import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", "[data-theme=\"dark\"]"],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F59E0B",
          dark: "#D97706",
          yellow: "#FBBF24",
          cream: "#FFF7E6",
          mint: "#059669",
          sage: "#64748B",
        },
        surface: {
          DEFAULT: "#F8FAFC",
          card: "#FFFFFF",
        },
        ink: {
          DEFAULT: "#172033",
          muted: "#64748B",
        },
        line: "#D9E1EA",
        success: "#059669",
        danger: "#DC2626",
        warning: "#FBBF24",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(23 32 51 / 0.05)",
        panel: "0 8px 24px rgb(23 32 51 / 0.06)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
} satisfies Config;

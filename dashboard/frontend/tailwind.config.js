/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          900: "#05070d",
          800: "#0a0e18",
          700: "#0f1524",
          600: "#161d30",
          500: "#1e2740",
        },
        accent: {
          DEFAULT: "#10b981",
          light: "#d1fae5",
          dark: "#059669",
        },
        signal: {
          stable: "#10b981",
          watch: "#f59e0b",
          alert: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'DM Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px -4px rgba(16, 185, 129, 0.3)",
        panel: "0 8px 40px -8px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.06)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.3, 1) infinite",
        shimmer: "shimmer 2s infinite",
        "fade-up": "fade-up 0.5s ease forwards",
      },
    },
  },
  plugins: [],
};

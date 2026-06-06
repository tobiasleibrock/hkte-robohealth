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
          DEFAULT: "#36e2c4",
          glow: "#5cf0d6",
          deep: "#0fb89a",
        },
        signal: {
          stable: "#36e2c4",
          watch: "#f5c451",
          alert: "#ff5d73",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 30px -5px rgba(54, 226, 196, 0.35)",
        panel: "0 24px 60px -20px rgba(0, 0, 0, 0.7)",
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

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg":    "#faf8f4",
        "surface":   "#ffffff",
        "surface2":  "#f4f0e8",
        "accent":    "#c0392b",
        "accent2":   "#1d4ed8",
        "text-main": "#1c1917",
        "text-dim":  "#a8998e",
      },
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        mono:    ["'Space Mono'", "monospace"],
        body:    ["'Libre Baskerville'", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

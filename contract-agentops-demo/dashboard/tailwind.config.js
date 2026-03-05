/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eff6ff", 500: "#3b82f6", 700: "#1d4ed8", 900: "#1e3a5f" },
        risk: { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#f8f4e8",
        saffron: "#f59e0b",
        paprika: "#ef4444",
        basil: "#10b981",
        espresso: "#1f2937",
      },
      boxShadow: {
        glow: "0 20px 60px rgba(239, 68, 68, 0.20)",
      },
      backgroundImage: {
        "warm-gradient": "linear-gradient(135deg, #f97316 0%, #facc15 45%, #34d399 100%)",
      },
    },
  },
  plugins: [],
};

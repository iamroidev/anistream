/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#faf9f6",
        champagne: "#f4f2ea",
        charcoal: "#1c1c1c",
        taupe: "#7a7368",
        gold: "#b8986c",
        "gold-dark": "#8e714b",
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

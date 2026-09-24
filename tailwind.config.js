/** @type {import('tailwindcss').Config} */
import trac from "tailwindcss-react-aria-components";
import contQueries from "@tailwindcss/container-queries";

export default {
  content: ["./index.html", "./download.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    fontSize: {
      xs: "0.4rem",
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui"],
      },
      colors: {
        primary: "#e65f2b",
        "primary-content": "#ffffff",
        secondary:
          "light-dark(oklch(69.71% 0.329 342.55), oklch(74.8% 0.26 342.55))",
        accent:
          "light-dark(oklch(76.76% 0.184 183.61), oklch(74.51% 0.167 183.61))",
        "base-content": "#17201d",
        "base-100": "#eef1ed",
        "base-200": "#dfe5df",
        "base-300": "#cbd3cc",
      },
    },

    fontFamily: {
      keycap: ["Inter", "system-ui"],
    },
  },
  plugins: [contQueries, trac({ prefix: "rac" })],
};

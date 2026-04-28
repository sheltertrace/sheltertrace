import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: "#0f2942",
        teal: {
          DEFAULT: "#1a8a8a",
          light: "#20a8a8",
        },
      },
    },
  },
  plugins: [],
};

export default config;

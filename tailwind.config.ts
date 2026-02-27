import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        slateNight: "#0B1220",
        navyDeep: "#10243F",
        ink: "#0F172A",
        mist: "#D4DFED"
      },
      boxShadow: {
        panel: "0 18px 48px rgba(12, 23, 42, 0.18)"
      },
      borderRadius: {
        panel: "1rem"
      }
    }
  },
  plugins: []
};

export default config;

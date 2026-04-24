/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette ported straight from your Gradio app
        bg:      { app: "#FAFAF5", card: "#FFFFFF", muted: "#F4F2EA" },
        border:  { DEFAULT: "#DDDACB", dim: "#EFEDE5" },
        txt:     { primary: "#1A1A1A", secondary: "#666666", tertiary: "#999999" },
        purple: {
          50:  "#EEEDFE",
          100: "#CECBF6",
          200: "#AFA9EC",
          400: "#7F77DD",
          600: "#534AB7",
          800: "#3C3489",
          900: "#26215C",
        },
        teal: {
          50:  "#E1F5EE",
          500: "#1D9E75",
          600: "#0F6E56",
          700: "#085041",
          800: "#04342C",
        },
        amber: {
          50:  "#FAEEDA",
          900: "#633806",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans:    ['"Inter Tight"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ['"JetBrains Mono"', "ui-monospace", "SF Mono", "monospace"],
      },
    },
  },
  plugins: [],
}

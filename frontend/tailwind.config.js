/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cream + warm neutrals (unchanged — ported from the Gradio app)
        bg:      { app: "#FAFAF5", card: "#FFFFFF", muted: "#F4F2EA" },
        border:  { DEFAULT: "#DDDACB", dim: "#EFEDE5" },
        txt:     { primary: "#1A1A1A", secondary: "#666666", tertiary: "#999999" },

        // Purple — expanded with intermediate shades for gradient depth
        purple: {
          25:  "#F7F6FE",  // NEW — ultralight wash
          50:  "#EEEDFE",
          100: "#CECBF6",
          200: "#AFA9EC",
          300: "#9690E4",  // NEW — for mid-stop gradients
          400: "#7F77DD",
          500: "#6B62CA",  // NEW — bridge between 400 and 600
          600: "#534AB7",
          700: "#453CA0",  // NEW — between 600 and 800
          800: "#3C3489",
          900: "#26215C",
        },

        // Teal — more gradient stops for the winner moment
        teal: {
          25:  "#F3FBF8",  // NEW — wash
          50:  "#E1F5EE",
          100: "#C5EADE",  // NEW
          200: "#97D8C1",  // NEW
          300: "#5CC0A0",  // NEW
          400: "#2EAE86",  // NEW
          500: "#1D9E75",
          600: "#0F6E56",
          700: "#085041",
          800: "#04342C",
        },

        // Amber — for low-confidence states, expanded
        amber: {
          25:  "#FFFBF2",  // NEW
          50:  "#FAEEDA",
          100: "#F4DEB8",  // NEW
          500: "#E09F3E",  // NEW — warmer accent
          700: "#9B691E",  // NEW
          900: "#633806",
        },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans:    ['"Inter Tight"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ['"JetBrains Mono"', "ui-monospace", "SF Mono", "monospace"],
      },
      // Max-width step up so we can breathe on wider screens
      maxWidth: {
        "7xl": "80rem",   // standard
        "prose-wide": "66rem",
      },
      // Custom keyframes for subtle ambient motion on gradient cards
      keyframes: {
        "gradient-drift": {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%":      { "background-position": "100% 50%" },
        },
      },
      animation: {
        "gradient-drift": "gradient-drift 18s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
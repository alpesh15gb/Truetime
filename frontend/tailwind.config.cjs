module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2c7be5",
          dark: "#1b5cb8"
        },
        surface: "#f5f6fa"
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(44, 123, 229, 0.3)",
        soft: "0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04)"
      }
    }
  },
  plugins: []
};

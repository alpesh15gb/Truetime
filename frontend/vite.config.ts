import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    open: false,
    allowedHosts: [
      "a76c95a0-8bd8-464e-971e-6b827763bb49.preview.emergentagent.com",
      ".emergentagent.com"
    ]
  }
});

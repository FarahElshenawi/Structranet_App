import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // All /api/* requests go to Express :3000.
      // Express handles auth, chat, profile, and proxies /api/ai/* to FastAPI :8000.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});

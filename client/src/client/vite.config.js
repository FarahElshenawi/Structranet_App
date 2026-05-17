import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // No proxy needed — both backends have CORS configured to allow
    // requests from http://localhost:5173. The client uses direct URLs
    // via VITE_AUTH_URL and VITE_API_URL environment variables.
    //
    // If you prefer proxy-based routing in the future, uncomment below:
    // proxy: {
    //   "/api/auth": {
    //     target: "http://localhost:3000",
    //     changeOrigin: true,
    //     // DO NOT rewrite — backend already uses /api/auth/* routes
    //   },
    //   "/api/chats": {
    //     target: "http://localhost:3000",
    //     changeOrigin: true,
    //   },
    //   "/api/userchats": {
    //     target: "http://localhost:3000",
    //     changeOrigin: true,
    //   },
    //   "/api/sessions": {
    //     target: "http://localhost:8000",
    //     changeOrigin: true,
    //   },
    //   "/api/health": {
    //     target: "http://localhost:8000",
    //     changeOrigin: true,
    //   },
    //   "/api/catalog": {
    //     target: "http://localhost:8000",
    //     changeOrigin: true,
    //   },
    // },
  },
});

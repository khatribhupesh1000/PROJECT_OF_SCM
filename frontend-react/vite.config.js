import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/v1": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8080",
        changeOrigin: true
      },
      "/graphql": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8080",
        changeOrigin: true
      }
    }
  }
});

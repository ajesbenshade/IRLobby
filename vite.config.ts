import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import dotenv from "dotenv";
dotenv.config();

// Adjust plugin configuration to ensure compatibility
const plugins = [react(), runtimeErrorOverlay()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "client", "src"),
      "@shared": path.resolve(process.cwd(), "shared"),
    },
  },
  root: path.resolve(process.cwd(), "client"),
  build: {
    outDir: path.resolve(process.cwd(), "dist", "public"),
    emptyOutDir: true,
  },
});

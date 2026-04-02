import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000';
const apiBaseUrl = process.env.VITE_API_BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://liyf.app' : '');

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../../packages/shared"),
    },
  },
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Optimize for mobile
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-toast', '@radix-ui/react-tabs'],
          utils: ['date-fns', 'lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 600,
    // Enable source maps for debugging but optimize for production
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
        secure: devProxyIsHttps,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/ws': {
        target: devProxyTarget,
        changeOrigin: true,
        secure: devProxyIsHttps,
        ws: true,
      }
    }
  },
  define: {
    __API_BASE_URL__: JSON.stringify(apiBaseUrl)
  }
});

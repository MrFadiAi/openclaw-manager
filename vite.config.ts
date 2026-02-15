import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Prevent Vite from clearing Rust error messages
  clearScreen: false,

  // Tauri expects a fixed port, fails if port is unavailable
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Ignore src-tauri directory changes
      ignored: ['**/src-tauri/**'],
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Production build configuration
  build: {
    // Tauri uses Chromium on Windows, WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows'
      ? 'chrome105'
      : 'safari14',
    // Disable minification for debugging
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Generate sourcemap for debugging
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Local dev: the FastAPI backend runs on :8000 (npm run api).
    proxy: { '/api': 'http://localhost:8000' },
  },
});

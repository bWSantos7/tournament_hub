import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In Railway the request arrives through the platform proxy, so the Host
// header is the public Railway domain — we must allow it.  Pass
// VITE_ALLOWED_HOSTS as a comma-separated list to lock down in other envs.
const allowedHosts: string[] | true = process.env.VITE_ALLOWED_HOSTS
  ? process.env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim())
  : true;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts,
  },
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path' // تأكد من استيراد هذه المكتبة

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // هذا السطر هو المسؤول عن حل مشكلة الـ @ في المسارات
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
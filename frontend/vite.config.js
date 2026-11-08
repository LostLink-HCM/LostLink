import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8080,
  },
  preview: {
    port: 8080,
  },
  // SDK VietMap chỉ có trong component tải lười: khai báo sẵn để Vite không phải gộp lại giữa chừng
  optimizeDeps: {
    include: ['@vietmap/vietmap-gl-js/dist/vietmap-gl.js'],
  },
  build: {
    rolldownOptions: {
      output: {
        // Tách thư viện ít đổi để giữ cache giữa các lần deploy. Chunk sentry chỉ có khi có VITE_SENTRY_DSN
        codeSplitting: {
          // Đường dẫn module luôn dùng "/", kể cả trên Windows
          groups: [
            {
              name: 'react',
              test: /node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//,
            },
            { name: 'sentry', test: /node_modules\/@sentry(-internal)?\// },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})

import { defineConfig, devices } from '@playwright/test'

import { API_PORT, MAILBOX_PORT, WEB_PORT } from './tests/setup/ports.js'

const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests/e2e',
  // Kết quả chạy (ảnh chụp, trace khi lỗi) và báo cáo HTML để trong tests/, không rải ở gốc frontend
  outputDir: './tests/results',
  fullyParallel: true,
  // Cả bộ test dùng chung một backend, nhiều trình duyệt chạy cùng lúc dễ làm test chậm và hết giờ
  workers: 2,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never', outputFolder: './tests/report' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Backend thật + MongoDB trong bộ nhớ, email giữ lại ở mailbox
      command: 'node tests/e2e/server.js',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        PORT: String(API_PORT),
        E2E_MAILBOX_PORT: String(MAILBOX_PORT),
        CLIENT_URL: `http://localhost:${WEB_PORT}`,
      },
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      // Chạy bản build như production: trang tải nhanh, không phải đợi Vite dev biên dịch từng trang.
      // Build ra thư mục riêng để không ghi đè dist
      command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      // Biến môi trường có sẵn được Vite ưu tiên hơn frontend/.env, kể cả lúc build
      env: {
        VITE_API_URL: `http://localhost:${API_PORT}/api`,
        VITE_GOOGLE_CLIENT_ID: '',
        VITE_SENTRY_DSN: '',
      },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
})

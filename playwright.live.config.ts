import { defineConfig, devices } from '@playwright/test'

// Runs the smoke test against the deployed website instead of a local build.
// Usage: npm run test:live   (optionally LIVE_URL=https://... npm run test:live)
export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.LIVE_URL ?? 'https://campusos-one-mu.vercel.app',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

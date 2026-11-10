import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: 'node ./node_modules/next/dist/bin/next start -p 3022 -H 127.0.0.1',
    env: {
      NEXT_DIST_DIR: '.next-e2e',
      PLAYWRIGHT_TEST: 'true',
      DATABASE_STORAGE: 'in_memory',
    },
    url: 'http://127.0.0.1:3022',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 60000,
  },
  use: {
    baseURL: 'http://127.0.0.1:3022',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--headless=new',
      ],
    },
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});

import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Replit/Nix Chromium includes its shared libraries. Else use Playwright's install.
function systemChromium() {
  try { return execFileSync('which', ['chromium'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return undefined; }
}

// Use the running app, never a user's persistent browser profile.
export default defineConfig({
  testDir: './e2e',
  outputDir: '../../generated-artifacts/ethmar-e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.ETHMAR_E2E_URL || 'http://localhost:80/',
    launchOptions: { executablePath: systemChromium() },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});

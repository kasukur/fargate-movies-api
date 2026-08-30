import { defineConfig, devices } from '@playwright/test';

/**
 * Orchestration:
 * - Expects DynamoDB Local to be running (npm run db:local from the repo root)
 *   with the table created and seeded.
 * - Starts the API and the Vite dev server automatically via webServer,
 *   reusing already-running instances during local development.
 *
 * Override endpoints with API_URL / WEB_URL to run the suite against a
 * deployed environment instead.
 *
 * Troubleshooting:
 * - `Project(s) "api" not found. Available projects: ""` means Playwright was
 *   run from the repo root and never found this config. Run it from tests/e2e/,
 *   pass `-c tests/e2e/playwright.config.ts`, or use the root scripts
 *   `npm run test:e2e:api` / `npm run test:e2e:browser`.
 * - Both specs provision the director/genre they need via the API, so
 *   `npm run db:seed` is not required. DynamoDB Local must be running and the
 *   table created: `npm run db:local`, then `npm run db:create-table`.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'api',
      testMatch: /api\..*\.spec\.ts/,
      use: { baseURL: API_URL }
    },
    {
      name: 'chromium',
      testMatch: /.*\.e2e\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: process.env.API_URL
    ? undefined
    : [
        {
          command: 'npm run dev --workspace apps/api',
          cwd: '../..',
          url: `${API_URL}/health`,
          reuseExistingServer: true,
          timeout: 60_000,
          env: {
            PORT: '3000',
            TABLE_NAME: 'MoviesApp',
            AWS_REGION: 'ap-southeast-2',
            AWS_ACCESS_KEY_ID: 'local',
            AWS_SECRET_ACCESS_KEY: 'local',
            DYNAMODB_ENDPOINT: 'http://localhost:8000'
          }
        },
        {
          command: 'npm run dev --workspace apps/web',
          cwd: '../..',
          url: WEB_URL,
          reuseExistingServer: true,
          timeout: 60_000
        }
      ]
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "auth.spec.mjs",
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:4175", channel: "msedge", headless: true, screenshot: "only-on-failure" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    env: {
      VITE_API_URL: "http://127.0.0.1:4175/test-api",
      VITE_SUPABASE_URL: "https://shifts-auth-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_placeholder",
    },
  },
});

import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

// Load .env.local into process.env so integration tests have access to local environment secrets
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const localEnv: Record<string, string> = {};
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    // Handle inline comments: if quoted, extract between quotes; otherwise strip #
    if (val.startsWith('"')) {
      const closing = val.indexOf('"', 1);
      if (closing !== -1) val = val.slice(1, closing);
    } else if (val.startsWith("'")) {
      const closing = val.indexOf("'", 1);
      if (closing !== -1) val = val.slice(1, closing);
    } else {
      const commentIdx = val.indexOf('#');
      if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();
    }
    if (!process.env[key]) {
      localEnv[key] = val;
      process.env[key] = val;
    } else {
      localEnv[key] = process.env[key]!;
    }
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'scripts/skill-validation/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: localEnv,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

import { defineConfig } from 'vitest/config'
import path from 'path'

// Tests UNITARIOS (src/**): puros, sin red, corren en CI y en el build de
// Vercel como gate de deploy. Los de integración (tests/**) necesitan un
// dev server y usan vitest.integration.config.ts.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})

import { defineConfig } from 'vitest/config'
import path from 'path'

// Tests de INTEGRACIÓN: pegan a http://localhost:3000, requieren `npm run dev`
// corriendo. Correr con: npm run test:integration
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000,
    include: ['tests/**/*.test.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})

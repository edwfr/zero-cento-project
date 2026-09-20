import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// The suite must not depend on the machine's timezone: CI runs UTC, local
// machines do not. Tests that care about a timezone set it themselves with
// vi.stubEnv('TZ', ...) plus vi.useFakeTimers().
process.env.TZ = 'UTC'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/unit/setup.ts'],
        include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'tests/integration/**/*.{test,spec}.ts'],
        // /mnt/c under WSL is slow: 16 workers + coverage starves the pool and
        // produces "Failed to start forks worker" timeouts.
        maxWorkers: 4,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'json-summary', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/app/sentry-example-page/**',
                'src/app/api/sentry-example-api/**',
                'src/app/components-showcase/**',
                'src/instrumentation.ts',
                'src/instrumentation-client.ts',
                'src/sw.ts',
                'src/app/layout.tsx',
                'src/**/loading.tsx',
                // client-construction modules: no branches to verify
                'src/lib/prisma.ts',
                'src/lib/supabase-client.ts',
                'src/lib/supabase-server.ts',
                'src/**/*.d.ts',
            ],
            thresholds: {
                // Baseline floors measured on chore/test-quality, 2026-09-20. They
                // only go up: every phase raises them to the level it reaches.
                lines: 36, statements: 36, functions: 28, branches: 33,
                'src/lib/**': { lines: 67, statements: 67, functions: 65, branches: 62 },
                'src/schemas/**': { lines: 79, statements: 79, functions: 80, branches: 68 },
                'src/app/api/**': { lines: 57, statements: 56, functions: 63, branches: 54 },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})

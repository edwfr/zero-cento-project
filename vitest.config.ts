import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/unit/setup.ts'],
        include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'tests/integration/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: [
                'src/lib/calculations.ts',
                'src/lib/api-response.ts',
                'src/lib/password-utils.ts',
                'src/lib/date-format.ts',
                'src/lib/useSwipe.ts',
                'src/schemas/**',
                'src/components/StatCard.tsx',
                'src/components/ProgressBar.tsx',
                'src/components/LoadingSpinner.tsx',
                'src/components/MovementPatternTag.tsx',
                'src/components/RoleGuard.tsx',
                'src/components/ActionIconButton.tsx',
                'src/app/api/exercises/route.ts',
                'src/app/api/exercises/[id]/route.ts',
                'src/app/api/feedback/route.ts',
                'src/app/api/feedback/[id]/route.ts',
                'src/app/api/personal-records/route.ts',
                'src/app/api/personal-records/[id]/route.ts',
                'src/app/api/programs/route.ts',
                'src/app/api/users/route.ts',
                'src/app/api/movement-patterns/route.ts',
                'src/app/api/muscle-groups/route.ts',
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})

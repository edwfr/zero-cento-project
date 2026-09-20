import { vi } from 'vitest'

/**
 * Factory for vi.mock('@/lib/auth'). A bare automock is not usable here:
 * it evaluates the real module, whose top level calls `cache` from 'react',
 * and the client build of React 19 has no `cache` export ("cache is not a
 * function"). Use it as an async factory so the import happens after hoisting:
 *
 *   vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())
 */
export function authModuleMock() {
    return {
        getSession: vi.fn(),
        getSessionIncludingInactive: vi.fn(),
        requireAuth: vi.fn(),
        requireAuthDuringOnboarding: vi.fn(),
        requireRole: vi.fn(),
        isTrainerOwnsTrainee: vi.fn(),
        requireTrainerOwnership: vi.fn(),
        isTrainerOwnsProgram: vi.fn(),
        requireTrainerProgramOwnership: vi.fn(),
    }
}

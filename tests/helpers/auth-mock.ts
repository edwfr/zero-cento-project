import { vi } from 'vitest'
import {
    requireAuth,
    requireRole,
    requireTrainerOwnership,
    requireTrainerProgramOwnership,
    getSession,
    type AuthSession,
} from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { mockTrainerSession, mockAdminSession, mockTraineeSession } from './sessions'

/**
 * These helpers assume the test file mocked '@/lib/auth' with authModuleMock
 * (see tests/helpers/auth-module-mock.ts). They only configure return values;
 * they never install the mock themselves, because vi.mock is hoisted per file.
 */
function resolveAll(session: AuthSession, withOwnership: boolean): AuthSession {
    vi.mocked(requireAuth).mockResolvedValue(session)
    vi.mocked(requireRole).mockResolvedValue(session)
    vi.mocked(getSession).mockResolvedValue(session)
    if (withOwnership) {
        vi.mocked(requireTrainerOwnership).mockResolvedValue(session)
        vi.mocked(requireTrainerProgramOwnership).mockResolvedValue(session)
    }
    return session
}

export const asTrainer = (session: AuthSession = mockTrainerSession) => resolveAll(session, true)
export const asAdmin = (session: AuthSession = mockAdminSession) => resolveAll(session, false)
export const asTrainee = (session: AuthSession = mockTraineeSession) => resolveAll(session, false)

/** Every guard rejects with the 401 response apiError builds. */
export function asUnauthenticated(): void {
    const rejection = apiError('UNAUTHORIZED', 'Authentication required', 401)
    for (const guard of [requireAuth, requireRole, requireTrainerOwnership, requireTrainerProgramOwnership]) {
        vi.mocked(guard).mockRejectedValue(rejection)
    }
    vi.mocked(getSession).mockResolvedValue(null)
}

/** Role or ownership guards reject with 403; requireAuth still resolves. */
export function asForbidden(session: AuthSession = mockTraineeSession): void {
    const rejection = apiError('FORBIDDEN', 'Access denied', 403)
    vi.mocked(requireAuth).mockResolvedValue(session)
    vi.mocked(getSession).mockResolvedValue(session)
    for (const guard of [requireRole, requireTrainerOwnership, requireTrainerProgramOwnership]) {
        vi.mocked(guard).mockRejectedValue(rejection)
    }
}

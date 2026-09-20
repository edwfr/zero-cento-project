import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', async () => (await import('../../helpers/auth-module-mock')).authModuleMock())

import { requireRole, requireAuth } from '@/lib/auth'
import { asTrainer, asAdmin, asUnauthenticated } from '../../helpers/auth-mock'
import { mockTrainerSession, makeTrainerSession, makeSupabaseUser } from '../../helpers/sessions'

describe('auth mock helpers', () => {
    it('makeSupabaseUser returns a user with the id and email of the session', () => {
        const user = makeSupabaseUser({ id: 'u-1', email: 'a@b.it' })
        expect(user.id).toBe('u-1')
        expect(user.email).toBe('a@b.it')
        expect(user.app_metadata).toBeDefined()
    })

    it('asTrainer makes requireRole resolve with the trainer session', async () => {
        asTrainer()
        await expect(requireRole('trainer')).resolves.toEqual(mockTrainerSession)
        await expect(requireAuth()).resolves.toEqual(mockTrainerSession)
    })

    it('asTrainer accepts a custom session', async () => {
        const session = makeTrainerSession({ id: 'trainer-9' })
        asTrainer(session)
        await expect(requireRole('trainer')).resolves.toEqual(session)
    })

    it('asAdmin makes requireRole resolve with the admin session', async () => {
        asAdmin()
        const session = await requireRole('admin')
        expect(session.user.role).toBe('admin')
    })

    it('asUnauthenticated makes requireAuth reject with a 401 response', async () => {
        asUnauthenticated()
        await expect(requireAuth()).rejects.toSatisfy((thrown: Response) => thrown.status === 401)
    })
})

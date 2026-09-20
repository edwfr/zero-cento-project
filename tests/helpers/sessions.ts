import type { User } from '@supabase/supabase-js'
import type { AuthSession } from '@/lib/auth'

/** Minimal Supabase user: enough shape for handlers that only read id/email. */
export function makeSupabaseUser(overrides: Partial<User> = {}): User {
    return {
        id: 'supabase-uuid-1',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'user@zerocento.it',
        app_metadata: {},
        user_metadata: {},
        created_at: '2026-01-01T00:00:00.000Z',
        ...overrides,
    } as User
}

function makeSession(user: AuthSession['user']): AuthSession {
    return { user, supabaseUser: makeSupabaseUser({ id: user.id, email: user.email }) }
}

export const mockTrainerSession: AuthSession = makeSession({
    id: 'trainer-uuid-1',
    email: 'trainer@zerocento.it',
    firstName: 'Marco',
    lastName: 'Trainer',
    role: 'trainer',
    isActive: true,
})

export const mockAdminSession: AuthSession = makeSession({
    id: 'admin-uuid-1',
    email: 'admin@zerocento.it',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
})

export const mockTraineeSession: AuthSession = makeSession({
    id: 'trainee-uuid-1',
    email: 'trainee@zerocento.it',
    firstName: 'Mario',
    lastName: 'Atleta',
    role: 'trainee',
    isActive: true,
})

export const makeTrainerSession = (overrides: Partial<AuthSession['user']> = {}): AuthSession =>
    makeSession({ ...mockTrainerSession.user, ...overrides })

export const makeAdminSession = (overrides: Partial<AuthSession['user']> = {}): AuthSession =>
    makeSession({ ...mockAdminSession.user, ...overrides })

export const makeTraineeSession = (overrides: Partial<AuthSession['user']> = {}): AuthSession =>
    makeSession({ ...mockTraineeSession.user, ...overrides })

export const mockTrainerSession = {
    user: {
        id: 'trainer-uuid-1',
        email: 'trainer@zerocento.it',
        firstName: 'Marco',
        lastName: 'Trainer',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

export const mockAdminSession = {
    user: {
        id: 'admin-uuid-1',
        email: 'admin@zerocento.it',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

export const mockTraineeSession = {
    user: {
        id: 'trainee-uuid-1',
        email: 'trainee@zerocento.it',
        firstName: 'Mario',
        lastName: 'Atleta',
        role: 'trainee' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

/** Returns a trainer session with custom overrides. */
export const makeTrainerSession = (overrides: Partial<typeof mockTrainerSession.user> = {}) => ({
    ...mockTrainerSession,
    user: { ...mockTrainerSession.user, ...overrides },
})

/** Returns an admin session with custom overrides. */
export const makeAdminSession = (overrides: Partial<typeof mockAdminSession.user> = {}) => ({
    ...mockAdminSession,
    user: { ...mockAdminSession.user, ...overrides },
})

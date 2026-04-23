import { cache } from 'react'
import { createClient } from './supabase-server'
import { prisma } from './prisma'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Role } from '@prisma/client'
import { apiError } from './api-response'

const AUTH_ERROR_KEYS = {
    authenticationRequired: 'auth.authenticationRequired',
    accessDenied: 'auth.accessDenied',
    traineeAccessDenied: 'auth.traineeAccessDenied',
    programAccessDenied: 'auth.programAccessDenied',
    userNotFound: 'user.notFound',
} as const

export interface AuthSession {
    user: {
        id: string
        email: string
        firstName: string
        lastName: string
        role: Role
        isActive: boolean
    }
    supabaseUser: SupabaseUser
}

/**
 * Get current session from Supabase and enrich with Prisma user data
 * Returns null if not authenticated
 * Optimized: fast path reads from JWT metadata if complete; fallback to Prisma for legacy users
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
    const supabase = await createClient()

    // Use getUser() instead of getSession() for security
    // getUser() authenticates the token against Supabase Auth server
    const {
        data: { user: supabaseUser },
        error,
    } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
        return null
    }

    // Fast path: all fields in JWT metadata — skip Prisma call
    const meta = supabaseUser.user_metadata
    if (
        meta?.role &&
        meta?.firstName &&
        meta?.lastName &&
        meta?.isActive !== undefined
    ) {
        if (!meta.isActive) return null
        return {
            user: {
                id: supabaseUser.id,
                email: supabaseUser.email!,
                firstName: meta.firstName as string,
                lastName: meta.lastName as string,
                role: meta.role as Role,
                isActive: meta.isActive as boolean,
            },
            supabaseUser,
        }
    }

    // Fallback: legacy users without complete metadata — hit Prisma
    const user = await prisma.user.findUnique({
        where: { email: supabaseUser.email },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
        },
    })

    if (!user || !user.isActive) {
        return null
    }

    return {
        user,
        supabaseUser,
    }
})

/**
 * Require authentication during onboarding - returns session without checking isActive
 * Used for activate endpoint where user needs to be authenticated but not yet active
 */
export async function requireAuthDuringOnboarding(): Promise<{ user: any; supabaseUser: SupabaseUser }> {
    const supabase = await createClient()

    // Use getUser() to authenticate the token
    const {
        data: { user: supabaseUser },
        error,
    } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
        throw apiError(
            'UNAUTHORIZED',
            'Authentication required',
            401,
            undefined,
            AUTH_ERROR_KEYS.authenticationRequired
        )
    }

    // Fetch user data from Prisma using email (without checking isActive)
    const user = await prisma.user.findUnique({
        where: { email: supabaseUser.email },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
        },
    })

    if (!user) {
        throw apiError('UNAUTHORIZED', 'User not found', 401, undefined, AUTH_ERROR_KEYS.userNotFound)
    }

    return {
        user,
        supabaseUser,
    }
}

/**
 * Require authentication - returns session or throws 401 error response
 */
export async function requireAuth(): Promise<AuthSession> {
    const session = await getSession()

    if (!session) {
        throw apiError(
            'UNAUTHORIZED',
            'Authentication required',
            401,
            undefined,
            AUTH_ERROR_KEYS.authenticationRequired
        )
    }

    return session
}

/**
 * Require specific role(s) - returns session or throws 403 error response
 */
export async function requireRole(
    allowedRoles: Role | Role[]
): Promise<AuthSession> {
    const session = await requireAuth()

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

    if (!roles.includes(session.user.role)) {
        throw apiError(
            'FORBIDDEN',
            `Access denied. Required role: ${roles.join(' or ')}`,
            403,
            { requiredRoles: roles },
            AUTH_ERROR_KEYS.accessDenied
        )
    }

    return session
}

/**
 * Check if trainer owns a trainee
 * Used for trainer permission checks
 */
export async function isTrainerOwnsTrainee(
    trainerId: string,
    traineeId: string
): Promise<boolean> {
    const association = await prisma.trainerTrainee.findFirst({
        where: {
            trainerId,
            traineeId,
        },
    })

    return !!association
}

/**
 * Require trainer ownership of trainee
 */
export async function requireTrainerOwnership(
    traineeId: string
): Promise<AuthSession> {
    const session = await requireRole('trainer')

    const owns = await isTrainerOwnsTrainee(session.user.id, traineeId)

    if (!owns) {
        throw apiError(
            'FORBIDDEN',
            'You do not have access to this trainee',
            403,
            undefined,
            AUTH_ERROR_KEYS.traineeAccessDenied
        )
    }

    return session
}

/**
 * Check if trainer owns a program
 */
export async function isTrainerOwnsProgram(
    trainerId: string,
    programId: string
): Promise<boolean> {
    const program = await prisma.trainingProgram.findFirst({
        where: {
            id: programId,
            trainerId,
        },
    })

    return !!program
}

/**
 * Require trainer ownership of program
 */
export async function requireTrainerProgramOwnership(
    programId: string
): Promise<AuthSession> {
    const session = await requireRole('trainer')

    const owns = await isTrainerOwnsProgram(session.user.id, programId)

    if (!owns) {
        throw apiError(
            'FORBIDDEN',
            'You do not have access to this program',
            403,
            undefined,
            AUTH_ERROR_KEYS.programAccessDenied
        )
    }

    return session
}

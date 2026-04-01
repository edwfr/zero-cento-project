import { createClient } from './supabase-server'
import { prisma } from './prisma'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Role } from '@prisma/client'
import { apiError } from './api-response'

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
 * Uses getUser() instead of getSession() for security (authenticates against Supabase Auth server)
 */
export async function getSession(): Promise<AuthSession | null> {
    const supabase = createClient()

    // Use getUser() instead of getSession() for security
    // getUser() authenticates the token against Supabase Auth server
    const {
        data: { user: supabaseUser },
        error,
    } = await supabase.auth.getUser()

    if (error || !supabaseUser) {
        return null
    }

    // Fetch user data from Prisma using email
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
        return null
    }

    // Check if user is active
    if (!user.isActive) {
        return null
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
        throw apiError('UNAUTHORIZED', 'Authentication required', 401)
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
            403
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
            403
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
            403
        )
    }

    return session
}

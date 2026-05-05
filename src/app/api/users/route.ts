import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole, requireAuth } from '@/lib/auth'
import { createUserSchema } from '@/schemas/user'
import { logger } from '@/lib/logger'
import { syncUserMetadata } from '@/lib/sync-user-metadata'

/**
 * GET /api/users
 * List users based on role:
 * - Admin: all users
 * - Trainer: own trainees only
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth()
        const { searchParams } = new URL(request.url)
        const role = searchParams.get('role')
        const includeInactive = searchParams.get('includeInactive') === 'true'

        let users

        if (session.user.role === 'admin') {
            // Admin sees all users (active only by default; pass includeInactive=true for full list)
            const where: any = includeInactive ? {} : { isActive: true }
            if (role) where.role = role
            users = await prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            })
        } else if (session.user.role === 'trainer') {
            // Trainer sees only own active trainees
            const traineeAssociations = await prisma.trainerTrainee.findMany({
                where: {
                    trainerId: session.user.id,
                },
                include: {
                    trainee: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            role: true,
                            isActive: true,
                            createdAt: true,
                        },
                    },
                },
            })

            users = traineeAssociations
                .map((assoc) => assoc.trainee)
                .filter((trainee) => includeInactive || trainee.isActive)
        } else {
            return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
        }

        return apiSuccess({ items: users })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching users')
        return apiError('INTERNAL_ERROR', 'Failed to fetch users', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/users
 * Create new user:
 * - Admin can create trainer or trainee
 * - Trainer can create trainee only
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth()
        const body = await request.json()

        // Validate input
        const validation = createUserSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { email, firstName, lastName, role } = validation.data

        // Permission check
        if (role === 'admin') {
            return apiError('FORBIDDEN', 'Cannot create admin users', 403, undefined, 'user.cannotCreateAdmin')
        }

        if (role === 'trainer' && session.user.role !== 'admin') {
            return apiError('FORBIDDEN', 'Only admins can create trainers', 403, undefined, 'user.onlyAdminCreateTrainer')
        }

        if (role === 'trainee' && session.user.role !== 'admin' && session.user.role !== 'trainer') {
            return apiError('FORBIDDEN', 'Only admins and trainers can create trainees', 403, undefined, 'user.onlyAdminTrainerCreateTrainee')
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return apiError('CONFLICT', 'Email already exists', 409, undefined, 'user.emailExists')
        }

        // Invite user via email (no temporary password needed)
        const supabase = createAdminClient()
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
            email,
            {
                redirectTo: `${appUrl}/onboarding/set-password`,
                data: {
                    role,
                    firstName,
                    lastName,
                    locale: body.locale || 'it', // Default Italian
                },
            }
        )

        if (authError) {
            logger.error({ error: authError }, 'Failed to invite user')
            return apiError('INTERNAL_ERROR', 'Failed to send invitation', 500, undefined, 'internal.default')
        }

        // Create user in Prisma (inactive until they complete onboarding)
        const user = await prisma.user.create({
            data: {
                id: authData.user.id,
                email,
                firstName,
                lastName,
                role,
                isActive: false, // Will be activated after password setup
            },
        })

        await syncUserMetadata(user.id, { isActive: false })

        // If trainee and created by trainer, create trainer-trainee association
        if (role === 'trainee' && session.user.role === 'trainer') {
            await prisma.trainerTrainee.create({
                data: {
                    trainerId: session.user.id,
                    traineeId: user.id,
                },
            })
        }

        logger.info({ userId: user.id, role }, 'User invited successfully')

        return apiSuccess(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    isActive: user.isActive,
                    status: 'invitation_sent',
                },
                message: 'Invitation email sent successfully',
            },
            201
        )
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating user')
        return apiError('INTERNAL_ERROR', 'Failed to create user', 500, undefined, 'internal.default')
    }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole, requireAuth } from '@/lib/auth'
import { createUserSchema } from '@/schemas/user'
import { generateSecurePassword } from '@/lib/password-utils'
import { logger } from '@/lib/logger'

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

        let users

        if (session.user.role === 'admin') {
            // Admin sees all users
            users = await prisma.user.findMany({
                where: role ? { role: role as any } : undefined,
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
            // Trainer sees only own trainees
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

            users = traineeAssociations.map((assoc) => assoc.trainee)
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

        // Generate secure temporary password
        const tempPassword = generateSecurePassword(12)

        // Create user in Supabase Auth using admin client
        const supabase = createAdminClient()
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                role,
                mustChangePassword: true,
                firstName,
                lastName,
            },
        })

        if (authError) {
            logger.error({ error: authError }, 'Failed to create user in Supabase')
            return apiError('INTERNAL_ERROR', 'Failed to create user account', 500, undefined, 'internal.default')
        }

        // Create user in Prisma
        const user = await prisma.user.create({
            data: {
                id: authData.user.id,
                email,
                firstName,
                lastName,
                role,
                isActive: true,
            },
        })

        // If trainee and created by trainer, create trainer-trainee association
        if (role === 'trainee' && session.user.role === 'trainer') {
            await prisma.trainerTrainee.create({
                data: {
                    trainerId: session.user.id,
                    traineeId: user.id,
                },
            })
        }

        logger.info({ userId: user.id, role }, 'User created successfully')

        return apiSuccess(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    isActive: user.isActive,
                },
                tempPassword, // Return password ONCE
            },
            201
        )
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating user')
        return apiError('INTERNAL_ERROR', 'Failed to create user', 500, undefined, 'internal.default')
    }
}

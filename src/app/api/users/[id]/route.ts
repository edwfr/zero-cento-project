import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { updateUserSchema } from '@/schemas/user'
import { logger } from '@/lib/logger'

type Params = {
    params: {
        id: string
    }
}

/**
 * GET /api/users/[id]
 * Get user details
 */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const session = await requireAuth()
        const { id } = params

        // Fetch user
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        })

        if (!user) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        // Permission check
        if (session.user.role === 'trainer') {
            // Trainers can only see their own trainees
            const association = await prisma.trainerTrainee.findFirst({
                where: {
                    trainerId: session.user.id,
                    traineeId: id,
                },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }
        }
        // Admin can see anyone

        return apiSuccess({ user })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching user')
        return apiError('INTERNAL_ERROR', 'Failed to fetch user', 500, undefined, 'internal.default')
    }
}

/**
 * PUT /api/users/[id]
 * Update user
 */
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const session = await requireAuth()
        const { id } = params
        const body = await request.json()

        // Validate input
        const validation = updateUserSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        // Check user exists
        const existingUser = await prisma.user.findUnique({
            where: { id },
        })

        if (!existingUser) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        // Permission check
        if (session.user.role === 'trainer') {
            // Trainers can only update their own trainees
            const association = await prisma.trainerTrainee.findFirst({
                where: {
                    trainerId: session.user.id,
                    traineeId: id,
                },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }

            // Trainers cannot change role or isActive
            if (validation.data.isActive !== undefined) {
                return apiError('FORBIDDEN', 'Cannot modify user status', 403, undefined, 'user.cannotModifyStatus')
            }
        }

        // Update user
        const user = await prisma.user.update({
            where: { id },
            data: validation.data,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
            },
        })

        logger.info({ userId: id }, 'User updated')

        return apiSuccess({ user })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error updating user')
        return apiError('INTERNAL_ERROR', 'Failed to update user', 500, undefined, 'internal.default')
    }
}

/**
 * DELETE /api/users/[id]
 * Delete user (physical delete with cleanup)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const session = await requireAuth()
        const { id } = params

        // Check user exists
        const existingUser = await prisma.user.findUnique({
            where: { id },
        })

        if (!existingUser) {
            return apiError('NOT_FOUND', 'User not found', 404, undefined, 'user.notFound')
        }

        // Permission check
        if (session.user.role === 'trainer') {
            // Trainers can only delete their own trainees
            const association = await prisma.trainerTrainee.findFirst({
                where: {
                    trainerId: session.user.id,
                    traineeId: id,
                },
            })

            if (!association) {
                return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
            }
        }

        // Cannot delete admin users
        if (existingUser.role === 'admin') {
            return apiError('FORBIDDEN', 'Cannot delete admin users', 403, undefined, 'user.cannotDeleteAdmin')
        }

        // Delete user (cascade delete will handle related records)
        await prisma.user.delete({
            where: { id },
        })

        logger.info({ userId: id }, 'User deleted')

        return apiSuccess({
            message: 'User deleted successfully',
            messageKey: 'user.deletedSuccess',
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error deleting user')
        return apiError('INTERNAL_ERROR', 'Failed to delete user', 500, undefined, 'internal.default')
    }
}

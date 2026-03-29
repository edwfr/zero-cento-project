import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * PUT /api/admin/programs/[id]/override
 * Admin override: update an active/completed program, bypassing trainer restrictions
 * Body: { title?, traineeId?, notes? }
 * RBAC: admin only
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin'])
        const programId = params.id
        const body = await request.json()

        const { title, traineeId } = body

        if (!title && !traineeId) {
            return apiError('VALIDATION_ERROR', 'At least one field to update is required', 400)
        }

        // Verify program exists
        const existing = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: { id: true, title: true, status: true, traineeId: true, trainerId: true },
        })

        if (!existing) {
            return apiError('NOT_FOUND', 'Program not found', 404)
        }

        // Validate traineeId if provided
        if (traineeId) {
            const trainee = await prisma.user.findUnique({
                where: { id: traineeId },
                select: { id: true, role: true },
            })

            if (!trainee) {
                return apiError('NOT_FOUND', 'Trainee not found', 404)
            }

            if (trainee.role !== 'trainee') {
                return apiError('VALIDATION_ERROR', 'Target user must have trainee role', 400)
            }
        }

        const program = await prisma.trainingProgram.update({
            where: { id: programId },
            data: {
                ...(title && { title }),
                ...(traineeId && { traineeId }),
            },
            include: {
                trainer: {
                    select: { id: true, firstName: true, lastName: true },
                },
                trainee: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
        })

        logger.info(
            { programId, adminId: session.user.id, changes: { title, traineeId } },
            'Program overridden by admin'
        )

        return apiSuccess({ program })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId: params.id }, 'Error overriding program')
        return apiError('INTERNAL_ERROR', 'Failed to override program', 500)
    }
}

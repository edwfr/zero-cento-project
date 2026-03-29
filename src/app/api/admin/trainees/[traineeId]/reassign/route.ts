import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/trainees/[traineeId]/reassign
 * Reassign a trainee from one trainer to another
 * Body: { newTrainerId }
 * RBAC: admin only
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { traineeId: string } }
) {
    try {
        const session = await requireRole(['admin'])
        const { traineeId } = params
        const body = await request.json()
        const { newTrainerId } = body

        if (!newTrainerId) {
            return apiError('VALIDATION_ERROR', 'newTrainerId is required', 400)
        }

        // Verify trainee exists and has trainee role
        const trainee = await prisma.user.findUnique({
            where: { id: traineeId },
            select: { id: true, role: true, firstName: true, lastName: true },
        })

        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404)
        }

        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400)
        }

        // Verify new trainer exists and has trainer role
        const newTrainer = await prisma.user.findUnique({
            where: { id: newTrainerId },
            select: { id: true, role: true, firstName: true, lastName: true },
        })

        if (!newTrainer) {
            return apiError('NOT_FOUND', 'New trainer not found', 404)
        }

        if (newTrainer.role !== 'trainer') {
            return apiError('VALIDATION_ERROR', 'Target user must have trainer role', 400)
        }

        // Update the TrainerTrainee relationship (upsert: create if missing, update if exists)
        const relation = await prisma.trainerTrainee.upsert({
            where: { traineeId },
            update: { trainerId: newTrainerId },
            create: { traineeId, trainerId: newTrainerId },
        })

        logger.info(
            {
                traineeId,
                newTrainerId,
                adminId: session.user.id,
            },
            'Trainee reassigned by admin'
        )

        return apiSuccess({
            message: `Trainee reassigned successfully`,
            relation,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, traineeId: params.traineeId }, 'Error reassigning trainee')
        return apiError('INTERNAL_ERROR', 'Failed to reassign trainee', 500)
    }
}

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * DELETE /api/personal-records/[id]
 * Delete personal record
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const recordId = params.id

        // Check if record exists
        const record = await prisma.personalRecord.findUnique({
            where: { id: recordId },
            include: {
                trainee: true,
            },
        })

        if (!record) {
            return apiError('NOT_FOUND', 'Personal record not found', 404)
        }

        // If trainer, verify they own this trainee via TrainerTrainee junction
        if (session.user.role === 'trainer') {
            const trainerRelation = await prisma.trainerTrainee.findUnique({
                where: {
                    traineeId: record.traineeId,
                },
            })

            if (!trainerRelation || trainerRelation.trainerId !== session.user.id) {
                return apiError('FORBIDDEN', 'You can only delete records for your own trainees', 403)
            }
        }

        // Delete record
        await prisma.personalRecord.delete({
            where: { id: recordId },
        })

        logger.info({ recordId, userId: session.user.id }, 'Personal record deleted')

        return apiSuccess({ message: 'Personal record deleted successfully' })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, recordId: params.id }, 'Error deleting personal record')
        return apiError('INTERNAL_ERROR', 'Failed to delete personal record', 500)
    }
}

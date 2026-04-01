import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { updatePersonalRecordSchema } from '@/schemas/personal-record'

/**
 * PATCH /api/personal-records/[id]
 * Update personal record
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const recordId = params.id
        const body = await request.json()

        // Validate input
        const validation = updatePersonalRecordSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        // Check if record exists
        const record = await prisma.personalRecord.findUnique({
            where: { id: recordId },
            include: {
                trainee: true,
            },
        })

        if (!record) {
            return apiError('NOT_FOUND', 'Personal record not found', 404, undefined, 'personalRecord.notFound')
        }

        // If trainer, verify they own this trainee
        if (session.user.role === 'trainer') {
            const trainerRelation = await prisma.trainerTrainee.findUnique({
                where: {
                    traineeId: record.traineeId,
                },
            })

            if (!trainerRelation || trainerRelation.trainerId !== session.user.id) {
                return apiError('FORBIDDEN', 'You can only update records for your own trainees', 403, undefined, 'personalRecord.updateDenied')
            }
        }

        // Build update data
        const updateData: any = {}
        if (validation.data.weight !== undefined) updateData.weight = validation.data.weight
        if (validation.data.reps !== undefined) updateData.reps = validation.data.reps
        if (validation.data.recordDate !== undefined) {
            updateData.recordDate = new Date(validation.data.recordDate)
        }
        if (validation.data.notes !== undefined) updateData.notes = validation.data.notes
        if (validation.data.exerciseId !== undefined) {
            // Verify exercise exists
            const exercise = await prisma.exercise.findUnique({
                where: { id: validation.data.exerciseId },
            })
            if (!exercise) {
                return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
            }
            updateData.exerciseId = validation.data.exerciseId
        }

        // Update record
        const updatedRecord = await prisma.personalRecord.update({
            where: { id: recordId },
            data: updateData,
            include: {
                exercise: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                    },
                },
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        })

        logger.info({ recordId, userId: session.user.id }, 'Personal record updated')

        return apiSuccess({ record: updatedRecord })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, recordId: params.id }, 'Error updating personal record')
        return apiError('INTERNAL_ERROR', 'Failed to update personal record', 500, undefined, 'internal.default')
    }
}

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
            return apiError('NOT_FOUND', 'Personal record not found', 404, undefined, 'personalRecord.notFound')
        }

        // If trainer, verify they own this trainee via TrainerTrainee junction
        if (session.user.role === 'trainer') {
            const trainerRelation = await prisma.trainerTrainee.findUnique({
                where: {
                    trainerId_traineeId: {
                        trainerId: session.user.id,
                        traineeId: record.traineeId,
                    },
                },
            })

            if (!trainerRelation) {
                return apiError('FORBIDDEN', 'You can only delete records for your own trainees', 403, undefined, 'personalRecord.deleteDenied')
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
        return apiError('INTERNAL_ERROR', 'Failed to delete personal record', 500, undefined, 'internal.default')
    }
}

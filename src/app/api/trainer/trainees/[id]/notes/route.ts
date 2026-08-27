import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import {
    EMPTY_TRAINER_TRAINEE_NOTE_DOCUMENT,
    sanitizeTrainerNoteDocument,
    trainerTraineeNotesSchema,
} from '@/schemas/trainer-trainee-notes'

type Params = {
    params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
    const { id: traineeId } = await params

    try {
        const session = await requireRole(['trainer'])
        const association = await prisma.trainerTrainee.findFirst({
            where: {
                trainerId: session.user.id,
                traineeId,
            },
            select: {
                trainerNotes: true,
                trainerNotesUpdatedAt: true,
            },
        })

        if (!association) {
            return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
        }

        return apiSuccess({
            document: association.trainerNotes ?? EMPTY_TRAINER_TRAINEE_NOTE_DOCUMENT,
            updatedAt: association.trainerNotesUpdatedAt,
        })
    } catch (error) {
        if (error instanceof Response) return error
        logger.error({ error, traineeId }, 'Failed to fetch trainer trainee notes')
        return apiError('INTERNAL_ERROR', 'Failed to fetch trainer trainee notes', 500, undefined, 'internal.default')
    }
}

export async function PUT(request: NextRequest, { params }: Params) {
    const { id: traineeId } = await params

    try {
        const session = await requireRole(['trainer'])
        const body = await request.json()
        const validation = trainerTraineeNotesSchema.safeParse(body)

        if (!validation.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid trainer note document',
                400,
                validation.error.flatten(),
                'validation.invalidTrainerNoteDocument'
            )
        }

        const sanitizedDocument = sanitizeTrainerNoteDocument(validation.data.document).document

        const association = await prisma.trainerTrainee.findFirst({
            where: {
                trainerId: session.user.id,
                traineeId,
            },
            select: { id: true },
        })

        if (!association) {
            return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
        }

        const updatedAt = new Date()
        const updatedAssociation = await prisma.trainerTrainee.update({
            where: { id: association.id },
            data: {
                trainerNotes: sanitizedDocument as unknown as Prisma.InputJsonValue,
                trainerNotesUpdatedAt: updatedAt,
            },
            select: {
                trainerNotes: true,
                trainerNotesUpdatedAt: true,
            },
        })

        logger.info({ traineeId, trainerId: session.user.id }, 'Trainer trainee notes saved')

        return apiSuccess({
            document: updatedAssociation.trainerNotes,
            updatedAt: updatedAssociation.trainerNotesUpdatedAt,
        })
    } catch (error) {
        if (error instanceof Response) return error
        logger.error({ error, traineeId }, 'Failed to save trainer trainee notes')
        return apiError('INTERNAL_ERROR', 'Failed to save trainer trainee notes', 500, undefined, 'internal.default')
    }
}

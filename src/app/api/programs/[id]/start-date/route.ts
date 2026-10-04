import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { isProgramVisibleToTrainee, todayInRome, weekStartDate } from '@/lib/program-visibility'

const startDateSchema = z.object({
    startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
        .refine((value) => {
            const date = new Date(`${value}T00:00:00Z`)
            return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
        }, 'Invalid calendar date'),
})

/**
 * PATCH /api/programs/[id]/start-date
 * Move the start date of a published program that the trainee cannot see yet.
 * Body: { startDate: 'YYYY-MM-DD' }, today or later (Rome calendar day).
 * Week start dates are recomputed as on publish.
 * RBAC: trainer owner or admin.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        const validation = startDateSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const newStartDate = new Date(`${validation.data.startDate}T00:00:00Z`)

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: {
                id: true,
                trainerId: true,
                status: true,
                startDate: true,
                weeks: { select: { id: true, weekNumber: true } },
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        // Editable only while published and not yet visible to the trainee
        if (program.status !== 'active' || isProgramVisibleToTrainee(program)) {
            return apiError(
                'VALIDATION_ERROR',
                'Start date can be changed only for published programs that have not started yet',
                400,
                undefined,
                'program.startDateNotEditable'
            )
        }

        if (newStartDate < todayInRome()) {
            return apiError('VALIDATION_ERROR', 'Start date cannot be in the past', 400, undefined, 'program.startDateInPast')
        }

        await prisma.$transaction([
            prisma.trainingProgram.update({
                where: { id: programId },
                data: { startDate: newStartDate },
            }),
            ...program.weeks.map((week) =>
                prisma.week.update({
                    where: { id: week.id },
                    data: { startDate: weekStartDate(newStartDate, week.weekNumber) },
                })
            ),
        ])

        logger.info(
            { programId, startDate: validation.data.startDate, userId: session.user.id },
            'Program start date changed'
        )

        return apiSuccess({ startDate: newStartDate.toISOString() })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error changing program start date',
            message: 'Failed to change program start date',
            key: 'internal.default',
            context: { programId },
        })
    }
}

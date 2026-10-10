import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireTrainerOwnership } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { isoDayToDbDate, type PlanProgramDto } from '@/lib/macro-periods'
import { PERIOD_SELECT, PLAN_PROGRAM_SELECT, macroPlanLockKey, toPeriodDto, toPlanProgramDto } from '@/lib/macro-period-queries'
import { createMacroPeriodSchema } from '@/schemas/macro-period'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/trainer/trainees/[id]/macro-periods
 * The trainee's plan as built by the calling trainer, plus the trainee's dated
 * programs for the read-only row of the timeline.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
    const { id: traineeId } = await params
    try {
        const session = await requireTrainerOwnership(traineeId)
        const trainerId = session.user.id

        const [periods, programs] = await Promise.all([
            prisma.macroPeriod.findMany({
                where: { traineeId, trainerId },
                orderBy: { startDate: 'asc' },
                select: PERIOD_SELECT,
            }),
            prisma.trainingProgram.findMany({
                where: { traineeId, trainerId, startDate: { not: null } },
                orderBy: { startDate: 'asc' },
                select: PLAN_PROGRAM_SELECT,
            }),
        ])

        return apiSuccess({
            periods: periods.map(toPeriodDto),
            programs: programs.map(toPlanProgramDto).filter((program): program is PlanProgramDto => program !== null),
        })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching macro periods',
            message: 'Failed to fetch macro periods',
            key: 'internal.default',
            context: { traineeId },
        })
    }
}

/**
 * POST /api/trainer/trainees/[id]/macro-periods
 * Body: { phaseTypeId, startDate, endDate, note? } — whole weeks, no overlap.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
    const { id: traineeId } = await params
    try {
        const session = await requireTrainerOwnership(traineeId)
        const trainerId = session.user.id

        const validation = createMacroPeriodSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }
        const { phaseTypeId, note } = validation.data
        const startDate = isoDayToDbDate(validation.data.startDate)
        const endDate = isoDayToDbDate(validation.data.endDate)

        const phaseType = await prisma.macroPhaseType.findFirst({
            where: { id: phaseTypeId, trainerId },
            select: { id: true, isActive: true },
        })
        if (!phaseType) {
            return apiError('NOT_FOUND', 'Macro phase type not found', 404, undefined, 'macroPhase.notFound')
        }
        if (!phaseType.isActive) {
            return apiError('CONFLICT', 'Macro phase type is archived', 409, undefined, 'macroPhase.archived')
        }

        // The overlap read belongs to the atomic unit: check and insert together
        const period = await prisma.$transaction(async (tx) => {
            // Two writes on the same plan must not both pass the overlap read: queue them until commit
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${macroPlanLockKey(trainerId, traineeId)}))`

            const clash = await tx.macroPeriod.findFirst({
                where: { traineeId, trainerId, startDate: { lte: endDate }, endDate: { gte: startDate } },
                select: { id: true },
            })
            if (clash) return null

            return tx.macroPeriod.create({
                data: { traineeId, trainerId, phaseTypeId, startDate, endDate, note: note ?? null },
                select: PERIOD_SELECT,
            })
        })

        if (!period) {
            return apiError('CONFLICT', 'The period overlaps another period', 409, undefined, 'macroPeriod.overlap')
        }

        logger.info({ trainerId, traineeId, periodId: period.id }, 'Macro period created')

        return apiSuccess({ period: toPeriodDto(period) }, 201)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error creating macro period',
            message: 'Failed to create macro period',
            key: 'internal.default',
            context: { traineeId },
        })
    }
}

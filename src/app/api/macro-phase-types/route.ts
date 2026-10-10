import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { DEFAULT_PHASE_NAMES, PHASE_COLOR_PALETTE } from '@/lib/macro-periods'
import { PHASE_TYPE_SELECT, findPhaseNameClash, toPhaseTypeDto } from '@/lib/macro-period-queries'
import { createMacroPhaseTypeSchema } from '@/schemas/macro-period'

const listPhaseTypes = (trainerId: string) =>
    prisma.macroPhaseType.findMany({
        where: { trainerId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: PHASE_TYPE_SELECT,
    })

/**
 * GET /api/macro-phase-types
 * Every phase of the authenticated trainer, archived ones included.
 * A trainer without phases gets three placeholders to rename.
 */
export async function GET() {
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        let phaseTypes = await listPhaseTypes(trainerId)

        if (phaseTypes.length === 0) {
            // skipDuplicates: two concurrent first calls must not fail on the unique (trainerId, name)
            await prisma.macroPhaseType.createMany({
                data: DEFAULT_PHASE_NAMES.map((name, index) => ({
                    trainerId,
                    name,
                    color: PHASE_COLOR_PALETTE[index],
                    sortOrder: index,
                })),
                skipDuplicates: true,
            })
            phaseTypes = await listPhaseTypes(trainerId)
        }

        return apiSuccess({ items: phaseTypes.map(toPhaseTypeDto) })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching macro phase types',
            message: 'Failed to fetch macro phase types',
            key: 'internal.default',
        })
    }
}

/**
 * POST /api/macro-phase-types
 * Body: { name, description?, color }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole('trainer')
        const trainerId = session.user.id

        const validation = createMacroPhaseTypeSchema.safeParse(await request.json())
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }
        const { name, description, color } = validation.data

        if (await findPhaseNameClash(trainerId, name)) {
            return apiError('CONFLICT', 'A phase with this name already exists', 409, undefined, 'macroPhase.nameExists')
        }

        const last = await prisma.macroPhaseType.aggregate({ where: { trainerId }, _max: { sortOrder: true } })
        const sortOrder = last._max.sortOrder === null ? 0 : last._max.sortOrder + 1

        const phaseType = await prisma.macroPhaseType.create({
            data: { trainerId, name, description: description ?? null, color, sortOrder },
            select: PHASE_TYPE_SELECT,
        })

        logger.info({ trainerId, phaseTypeId: phaseType.id }, 'Macro phase type created')

        return apiSuccess({ phaseType: toPhaseTypeDto(phaseType) }, 201)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error creating macro phase type',
            message: 'Failed to create macro phase type',
            key: 'internal.default',
        })
    }
}

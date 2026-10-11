import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { workoutTemplateSchema } from '@/schemas/workout-template'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const notFound = () =>
    apiError('NOT_FOUND', 'Template not found', 404, undefined, 'template.notFound')

/** Single-query ownership check: another trainer's template is indistinguishable from a missing one. */
async function findOwnedTemplate(id: string, trainerId: string) {
    if (!UUID_RE.test(id)) return null
    return prisma.workoutTemplate.findFirst({ where: { id, trainerId } })
}

/**
 * GET /api/workout-templates/[id]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    let trainerId: string | undefined
    try {
        const session = await requireRole(['trainer'])
        trainerId = session.user.id
        if (!UUID_RE.test(id)) return notFound()

        const template = await prisma.workoutTemplate.findFirst({
            where: { id, trainerId: session.user.id },
            include: {
                workouts: {
                    orderBy: { dayIndex: 'asc' },
                    include: { exercises: { orderBy: { order: 'asc' } } },
                },
            },
        })
        if (!template) return notFound()

        return apiSuccess(template)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching workout template',
            message: 'Failed to fetch workout template',
            key: 'internal.default',
            context: { templateId: id, trainerId },
        })
    }
}

/**
 * PUT /api/workout-templates/[id]
 * Replaces name, workoutsPerWeek and all workouts; usageCount / lastUsedAt are untouched.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    let trainerId: string | undefined
    try {
        const session = await requireRole(['trainer'])
        trainerId = session.user.id

        const owned = await findOwnedTemplate(id, session.user.id)
        if (!owned) return notFound()

        const body = await request.json()
        const validation = workoutTemplateSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }
        const { name, workoutsPerWeek, workouts } = validation.data

        const distinctIds = [...new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))]
        if (distinctIds.length > 0) {
            const found = await prisma.exercise.findMany({
                where: { id: { in: distinctIds } },
                select: { id: true },
            })
            if (found.length < distinctIds.length) {
                return apiError('VALIDATION_ERROR', 'One or more exercises not found', 400, undefined, 'workout.exercisesNotFound')
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            await tx.workoutTemplateWorkout.deleteMany({ where: { templateId: id } })
            return tx.workoutTemplate.update({
                where: { id },
                data: {
                    name,
                    workoutsPerWeek,
                    workouts: {
                        create: workouts.map((w) => ({
                            dayIndex: w.dayIndex,
                            exercises: { create: w.exercises.map((e, i) => ({ ...e, order: i })) },
                        })),
                    },
                },
                include: {
                    workouts: {
                        orderBy: { dayIndex: 'asc' },
                        include: { exercises: { orderBy: { order: 'asc' } } },
                    },
                },
            })
        })

        logger.info({ templateId: id, trainerId: session.user.id }, 'Workout template updated')

        return apiSuccess(updated)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error updating workout template',
            message: 'Failed to update workout template',
            key: 'internal.default',
            context: { templateId: id, trainerId },
        })
    }
}

/**
 * DELETE /api/workout-templates/[id]
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    let trainerId: string | undefined
    try {
        const session = await requireRole(['trainer'])
        trainerId = session.user.id

        const owned = await findOwnedTemplate(id, session.user.id)
        if (!owned) return notFound()

        await prisma.workoutTemplate.delete({ where: { id } })

        logger.info({ templateId: id, trainerId: session.user.id }, 'Workout template deleted')

        return apiSuccess({ id })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error deleting workout template',
            message: 'Failed to delete workout template',
            key: 'internal.default',
            context: { templateId: id, trainerId },
        })
    }
}

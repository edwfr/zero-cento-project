import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api-error-handler'
import { workoutTemplateSchema } from '@/schemas/workout-template'

/**
 * GET /api/workout-templates
 * List the trainer's own templates with usage stats (no exercise detail).
 */
export async function GET() {
    let trainerId: string | undefined
    try {
        const session = await requireRole(['trainer'])
        trainerId = session.user.id

        const templates = await prisma.workoutTemplate.findMany({
            where: { trainerId: session.user.id },
            include: { workouts: { include: { exercises: { select: { id: true } } } } },
            orderBy: { updatedAt: 'desc' },
        })

        const items = templates.map((t) => ({
            id: t.id,
            name: t.name,
            workoutsPerWeek: t.workoutsPerWeek,
            exerciseCount: t.workouts.reduce((sum, w) => sum + w.exercises.length, 0),
            usageCount: t.usageCount,
            lastUsedAt: t.lastUsedAt,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
        }))

        return apiSuccess(items)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error listing workout templates',
            message: 'Failed to list workout templates',
            key: 'internal.default',
            context: { trainerId },
        })
    }
}

/**
 * POST /api/workout-templates
 * Create a template owned by the current trainer.
 */
export async function POST(request: NextRequest) {
    let trainerId: string | undefined
    try {
        const session = await requireRole(['trainer'])
        trainerId = session.user.id

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

        const template = await prisma.workoutTemplate.create({
            data: {
                trainerId: session.user.id,
                name,
                workoutsPerWeek,
                workouts: {
                    create: workouts.map((w) => ({
                        dayIndex: w.dayIndex,
                        exercises: { create: w.exercises.map((e, i) => ({ ...e, order: i + 1 })) },
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

        logger.info({ templateId: template.id, trainerId: session.user.id }, 'Workout template created')

        return apiSuccess(template, 201)
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error creating workout template',
            message: 'Failed to create workout template',
            key: 'internal.default',
            context: { trainerId },
        })
    }
}

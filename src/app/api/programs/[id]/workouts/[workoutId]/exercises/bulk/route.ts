import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { bulkSaveWorkoutExercisesSchema } from '@/schemas/workout-exercise'
import { logger } from '@/lib/logger'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; workoutId: string }> }
) {
    const { id: programId, workoutId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = bulkSaveWorkoutExercisesSchema.safeParse(body)
        if (!validation.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid input',
                400,
                validation.error.errors,
                'validation.invalidInput'
            )
        }

        const { exercises } = validation.data

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                weeks: {
                    include: {
                        workouts: { where: { id: workoutId }, select: { id: true } },
                    },
                },
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError(
                'FORBIDDEN',
                'You can only modify your own programs',
                403,
                undefined,
                'program.modifyDenied'
            )
        }

        if (session.user.role !== 'admin' && program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        const workoutExists = program.weeks
            .flatMap((w: any) => w.workouts)
            .some((w: any) => w.id === workoutId)
        if (!workoutExists) {
            return apiError(
                'NOT_FOUND',
                'Workout not found in this program',
                404,
                undefined,
                'workout.notFoundInProgram'
            )
        }

        const updateIds = exercises
            .map((row) => row.id)
            .filter((id): id is string => Boolean(id))

        if (updateIds.length > 0) {
            const existingForWorkout = await prisma.workoutExercise.findMany({
                where: { id: { in: updateIds }, workoutId },
                select: { id: true },
            })
            if (existingForWorkout.length !== updateIds.length) {
                return apiError(
                    'NOT_FOUND',
                    'One or more workout exercises not found',
                    404,
                    undefined,
                    'workoutExercise.notFound'
                )
            }
        }

        const referencedExerciseIds = Array.from(new Set(exercises.map((row) => row.exerciseId)))
        const referencedExercises = await prisma.exercise.findMany({
            where: { id: { in: referencedExerciseIds } },
            select: { id: true },
        })
        if (referencedExercises.length !== referencedExerciseIds.length) {
            return apiError(
                'NOT_FOUND',
                'One or more exercises not found',
                404,
                undefined,
                'exercise.notFound'
            )
        }

        const operations = exercises.map((row) => {
            const data = {
                workoutId,
                exerciseId: row.exerciseId,
                variant: row.variant ?? null,
                order: row.order,
                sets: row.sets,
                reps: typeof row.reps === 'number' ? row.reps.toString() : row.reps,
                notes: row.notes ?? null,
                targetRpe: row.targetRpe ?? null,
                weightType: row.weightType,
                weight: row.weight ?? null,
                effectiveWeight: row.effectiveWeight ?? null,
                restTime: row.restTime,
                isWarmup: row.isWarmup,
            }
            if (row.id) {
                return prisma.workoutExercise.update({ where: { id: row.id }, data })
            }
            return prisma.workoutExercise.create({ data })
        })

        await prisma.$transaction(operations)

        const workoutExercises = await prisma.workoutExercise.findMany({
            where: { workoutId },
            include: {
                exercise: {
                    include: {
                        movementPattern: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { order: 'asc' },
        })

        logger.info(
            {
                programId,
                workoutId,
                count: exercises.length,
                userId: session.user.id,
            },
            'Workout exercises bulk saved'
        )

        return apiSuccess({ workoutExercises })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error(
            { error, programId, workoutId },
            'Error bulk saving workout exercises'
        )
        return apiError(
            'INTERNAL_ERROR',
            'Failed to save workout exercises',
            500,
            undefined,
            'internal.default'
        )
    }
}

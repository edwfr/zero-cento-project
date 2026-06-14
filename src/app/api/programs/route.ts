import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { createProgramSchema, programFilterSchema } from '@/schemas/program'
import { logger } from '@/lib/logger'

interface ProgramTestsSummary {
    testWeeks: number[]
    testWeekSummaries: Array<{
        weekNumber: number
        plannedTestsCount: number
        completedTestsCount: number
        completed: boolean
    }>
    hasTestWeeks: boolean
    testsCompleted: boolean
    plannedTestsCount: number
    completedTestsCount: number
}

/**
 * GET /api/programs
 * List programs with filter-first pagination
 * Query params: trainerId, traineeId, status, search, page, limit, cursor
 * RBAC: Admin sees all, Trainer sees only own, Trainee sees only assigned
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const { searchParams } = new URL(request.url)

        // Parse and validate query parameters
        const filterParams = {
            trainerId: searchParams.get('trainerId') || undefined,
            traineeId: searchParams.get('traineeId') || undefined,
            status: searchParams.get('status') || undefined,
            search: searchParams.get('search') || undefined,
            cursor: searchParams.get('cursor') || undefined,
            page: searchParams.get('page') || undefined,
            limit: searchParams.get('limit') || undefined,
        }

        const validation = programFilterSchema.safeParse(filterParams)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid filter parameters', 400, validation.error.errors, 'validation.invalidFilterParams')
        }

        const { trainerId, traineeId, status, search, cursor, page, limit } = validation.data

        // Validate search parameter length
        if (search && (search.length < 2 || search.length > 100)) {
            return apiError('VALIDATION_ERROR', 'Search parameter must be between 2 and 100 characters', 400, undefined, 'validation.searchLength')
        }

        const useCursorPagination = Boolean(cursor) && !searchParams.has('page')

        // Build where clause based on RBAC
        const baseWhere: Prisma.TrainingProgramWhereInput = {}

        if (session.user.role === 'trainer') {
            // Trainers see only their own programs
            baseWhere.trainerId = session.user.id
            if (traineeId) {
                baseWhere.traineeId = traineeId
            }
        } else if (session.user.role === 'trainee') {
            // Trainees see only programs assigned to them
            baseWhere.traineeId = session.user.id
        } else {
            // Admins can filter by trainer/trainee
            if (trainerId) {
                baseWhere.trainerId = trainerId
            }

            if (traineeId) {
                baseWhere.traineeId = traineeId
            }
        }

        if (search) {
            baseWhere.OR = [
                {
                    title: {
                        contains: search,
                        mode: 'insensitive',
                    },
                },
                {
                    trainee: {
                        firstName: {
                            contains: search,
                            mode: 'insensitive',
                        },
                    },
                },
                {
                    trainee: {
                        lastName: {
                            contains: search,
                            mode: 'insensitive',
                        },
                    },
                },
            ]
        }

        const listWhere: Prisma.TrainingProgramWhereInput = {
            ...baseWhere,
            ...(status ? { status } : {}),
        }

        const [
            totalItems,
            draftCount,
            activeCount,
            completedCount,
        ] = await Promise.all([
            prisma.trainingProgram.count({ where: listWhere }),
            prisma.trainingProgram.count({ where: { ...baseWhere, status: 'draft' } }),
            prisma.trainingProgram.count({ where: { ...baseWhere, status: 'active' } }),
            prisma.trainingProgram.count({ where: { ...baseWhere, status: 'completed' } }),
        ])

        const totalPages = Math.max(1, Math.ceil(totalItems / limit))
        const resolvedPage = Math.min(page, totalPages)
        const skip = (resolvedPage - 1) * limit

        // Fetch programs with pagination (filter-first)
        const programs = await prisma.trainingProgram.findMany({
            where: listWhere,
            include: {
                trainer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                weeks: {
                    select: {
                        id: true,
                        weekNumber: true,
                        weekType: true,
                        isCompleted: true,
                    },
                    orderBy: {
                        weekNumber: 'asc',
                    },
                },
            },
            take: limit + 1,
            ...(useCursorPagination
                ? {
                    skip: 1,
                    cursor: {
                        id: cursor,
                    },
                }
                : {
                    skip,
                }),
            orderBy: [
                { createdAt: 'desc' },
            ],
        })

        const hasMore = programs.length > limit
        const items = hasMore ? programs.slice(0, limit) : programs
        const nextCursor = hasMore ? items[items.length - 1].id : null

        const programIds = items.map((program) => program.id)
        const completionByProgramId = new Map<
            string,
            { totalWorkouts: number; completedWorkouts: number; lastCompletedWorkoutAt: Date | null }
        >()
        const lastFeedbackByProgramId = new Map<string, Date>()

        if (programIds.length > 0) {
            const programIdSql = Prisma.join(programIds.map((id) => Prisma.sql`${id}`))

            // Single aggregate: per-program workout completion stats + last feedback timestamp.
            const completionRows = await prisma.$queryRaw<
                Array<{
                    programId: string
                    totalWorkouts: number
                    completedWorkouts: number
                    lastCompletedWorkoutAt: Date | null
                    lastFeedbackAt: Date | null
                }>
            >`
                WITH workout_completion AS (
                    SELECT
                        wk."id" AS workout_id,
                        w."programId",
                        COUNT(we."id") AS exercise_count,
                        COUNT(DISTINCT CASE WHEN ef."id" IS NOT NULL THEN we."id" END) AS completed_exercise_count,
                        MAX(ef."date") AS workout_last_feedback
                    FROM "workouts" wk
                    JOIN "weeks" w ON w."id" = wk."weekId"
                    LEFT JOIN "workout_exercises" we ON we."workoutId" = wk."id"
                    LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id"
                    WHERE w."programId" IN (${programIdSql})
                    GROUP BY wk."id", w."programId"
                )
                SELECT
                    "programId",
                    COUNT(*) FILTER (WHERE exercise_count > 0)::int AS "totalWorkouts",
                    COUNT(*) FILTER (WHERE exercise_count > 0 AND exercise_count = completed_exercise_count)::int AS "completedWorkouts",
                    MAX(workout_last_feedback) FILTER (WHERE exercise_count > 0 AND exercise_count = completed_exercise_count) AS "lastCompletedWorkoutAt",
                    MAX(workout_last_feedback) AS "lastFeedbackAt"
                FROM workout_completion
                GROUP BY "programId"
            `

            for (const row of completionRows) {
                completionByProgramId.set(row.programId, {
                    totalWorkouts: row.totalWorkouts,
                    completedWorkouts: row.completedWorkouts,
                    lastCompletedWorkoutAt: row.lastCompletedWorkoutAt,
                })
                if (row.lastFeedbackAt) {
                    lastFeedbackByProgramId.set(row.programId, row.lastFeedbackAt)
                }
            }
        }

        const enrichedItems = items
            .map((program) => {
                const completionSnapshot = completionByProgramId.get(program.id)
                const testWeeks = program.weeks.filter((week) => week.weekType === 'test')
                const completedTestWeeksCount = testWeeks.filter((week) => week.isCompleted).length
                const testsSummary: ProgramTestsSummary = {
                    testWeeks: testWeeks.map((week) => week.weekNumber),
                    testWeekSummaries: testWeeks.map((week) => ({
                        weekNumber: week.weekNumber,
                        plannedTestsCount: 1,
                        completedTestsCount: week.isCompleted ? 1 : 0,
                        completed: week.isCompleted,
                    })),
                    hasTestWeeks: testWeeks.length > 0,
                    testsCompleted:
                        testWeeks.length > 0 &&
                        completedTestWeeksCount === testWeeks.length,
                    plannedTestsCount: testWeeks.length,
                    completedTestsCount: completedTestWeeksCount,
                }

                return {
                    ...program,
                    completedAt:
                        program.completedAt ??
                        (program.status === 'completed'
                            ? completionSnapshot?.lastCompletedWorkoutAt ?? null
                            : null),
                    lastWorkoutCompletedAt:
                        lastFeedbackByProgramId.get(program.id)?.toISOString() ??
                        completionSnapshot?.lastCompletedWorkoutAt?.toISOString() ??
                        null,
                    totalWorkouts: completionSnapshot?.totalWorkouts ?? 0,
                    completedWorkouts: completionSnapshot?.completedWorkouts ?? 0,
                    testWeeks: testsSummary.testWeeks,
                    testWeekSummaries: testsSummary.testWeekSummaries,
                    hasTestWeeks: testsSummary.hasTestWeeks,
                    testsCompleted: testsSummary.testsCompleted,
                    plannedTestsCount: testsSummary.plannedTestsCount,
                    completedTestsCount: testsSummary.completedTestsCount,
                }
            })

        return apiSuccess({
            items: enrichedItems,
            statusCounts: {
                draft: draftCount,
                active: activeCount,
                completed: completedCount,
            },
            pagination: {
                nextCursor,
                hasMore,
                currentPage: resolvedPage,
                totalPages,
                totalItems,
                limit,
            },
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching programs')
        return apiError('INTERNAL_ERROR', 'Failed to fetch programs', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/programs
 * Create new program (status=draft)
 * Automatically creates Weeks and empty Workouts based on durationWeeks and workoutsPerWeek
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = createProgramSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const {
            title,
            traineeId,
            isSbdProgram,
            durationWeeks,
            workoutsPerWeek,
            cloneFromProgramId,
        } = validation.data

        // Verify trainee exists and is a trainee role
        const trainee = await prisma.user.findUnique({
            where: { id: traineeId },
        })

        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
        }

        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
        }

        // If session user is trainer, verify they own/manage this trainee
        // Note: Trainee ownership is managed via TrainerTrainee table
        if (session.user.role === 'trainer') {
            const trainerRelation = await prisma.trainerTrainee.findFirst({
                where: {
                    trainerId: session.user.id,
                    traineeId,
                },
            })
            if (!trainerRelation) {
                return apiError('FORBIDDEN', 'You can only create programs for your own trainees', 403, undefined, 'program.createDenied')
            }
        }

        // Create program with nested weeks and workouts
        const weeksData = Array.from({ length: durationWeeks }, (_, weekIdx) => ({
            weekNumber: weekIdx + 1,
            weekType: 'volume' as const,
            workouts: {
                create: Array.from({ length: workoutsPerWeek }, (_, workoutIdx) => ({
                    dayIndex: workoutIdx + 1,
                })),
            },
        }))

        // Get trainer ID from relation or use session user
        let actualTrainerId = session.user.id
        if (session.user.role === 'admin') {
            const trainerRelation = await prisma.trainerTrainee.findUnique({
                where: { traineeId },
            })
            if (trainerRelation) {
                actualTrainerId = trainerRelation.trainerId
            }
        }

        if (cloneFromProgramId) {
            const source = await prisma.trainingProgram.findUnique({
                where: { id: cloneFromProgramId },
                select: {
                    id: true,
                    trainerId: true,
                    workoutsPerWeek: true,
                },
            })

            if (!source) {
                return apiError(
                    'NOT_FOUND',
                    'Source program not found',
                    404,
                    undefined,
                    'program.cloneSourceNotFound'
                )
            }

            if (session.user.role === 'trainer' && source.trainerId !== session.user.id) {
                return apiError(
                    'FORBIDDEN',
                    'Cannot clone another trainer\'s program',
                    403,
                    undefined,
                    'program.cloneDenied'
                )
            }

            if (source.workoutsPerWeek !== workoutsPerWeek) {
                return apiError(
                    'VALIDATION_ERROR',
                    'workoutsPerWeek must match the source program',
                    400,
                    undefined,
                    'validation.workoutsPerWeekMismatchWithClone'
                )
            }
        }

        const program = await prisma.$transaction(async (tx) => {
            const createdProgram = await tx.trainingProgram.create({
                data: {
                    title,
                    trainerId: actualTrainerId,
                    traineeId,
                    isSbdProgram,
                    durationWeeks,
                    workoutsPerWeek,
                    status: 'draft',
                    weeks: {
                        create: weeksData,
                    },
                },
                include: {
                    trainer: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    trainee: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    weeks: {
                        include: {
                            workouts: true,
                        },
                        orderBy: {
                            weekNumber: 'asc',
                        },
                    },
                },
            })

            if (cloneFromProgramId) {
                const sourceRows = await tx.workoutSkeleton.findMany({
                    where: { programId: cloneFromProgramId },
                    select: {
                        dayIndex: true,
                        order: true,
                        exerciseId: true,
                    },
                })

                if (sourceRows.length > 0) {
                    await tx.workoutSkeleton.createMany({
                        data: sourceRows.map((row) => ({
                            programId: createdProgram.id,
                            dayIndex: row.dayIndex,
                            order: row.order,
                            exerciseId: row.exerciseId,
                        })),
                    })
                }
            }

            return createdProgram
        })

        logger.info(
            {
                programId: program.id,
                trainerId: program.trainerId,
                traineeId: program.traineeId,
                clonedFrom: cloneFromProgramId ?? null,
            },
            'Program created successfully'
        )

        return apiSuccess({ program }, 201)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating program')
        return apiError('INTERNAL_ERROR', 'Failed to create program', 500, undefined, 'internal.default')
    }
}

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { createProgramSchema } from '@/schemas/program'
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
 * List programs with cursor-based pagination
 * Query params: trainerId, traineeId, status, search, cursor
 * RBAC: Admin sees all, Trainer sees only own, Trainee sees only assigned
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const { searchParams } = new URL(request.url)

        const trainerId = searchParams.get('trainerId') || undefined
        const traineeId = searchParams.get('traineeId') || undefined
        const status = searchParams.get('status') || undefined
        const search = searchParams.get('search') || undefined
        const cursor = searchParams.get('cursor') || undefined
        const limit = parseInt(searchParams.get('limit') || '20')

        // Validate search parameter length
        if (search && (search.length < 2 || search.length > 100)) {
            return apiError('VALIDATION_ERROR', 'Search parameter must be between 2 and 100 characters', 400, undefined, 'validation.searchLength')
        }

        // Build where clause based on RBAC
        const where: any = {}

        if (session.user.role === 'trainer') {
            // Trainers see only their own programs
            where.trainerId = session.user.id
        } else if (session.user.role === 'trainee') {
            // Trainees see only programs assigned to them
            where.traineeId = session.user.id
        }
        // Admin sees all programs (no additional filter)

        // Apply additional filters
        if (trainerId) {
            where.trainerId = trainerId
        }

        if (traineeId) {
            where.traineeId = traineeId
        }

        if (status === 'draft' || status === 'active' || status === 'completed') {
            where.status = status
        }

        if (search) {
            where.title = {
                contains: search,
                mode: 'insensitive',
            }
        }

        // Fetch programs with cursor pagination
        const programs = await prisma.trainingProgram.findMany({
            where,
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
                    },
                    orderBy: {
                        weekNumber: 'asc',
                    },
                },
            },
            take: limit + 1,
            ...(cursor && {
                skip: 1,
                cursor: {
                    id: cursor,
                },
            }),
            orderBy: [
                { createdAt: 'desc' },
            ],
        })

        const hasMore = programs.length > limit
        const items = hasMore ? programs.slice(0, -1) : programs
        const nextCursor = hasMore ? items[items.length - 1].id : null

        const programIds = items.map((program) => program.id)
        const completionByProgramId = new Map<
            string,
            { totalWorkouts: number; completedWorkouts: number; lastCompletedWorkoutAt: Date | null }
        >()
        const lastFeedbackByProgramId = new Map<string, Date>()
        const testsSummaryByProgramId = new Map<string, ProgramTestsSummary>()

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

            // Single aggregate: per-week test-week stats. LEFT JOINs keep empty test weeks visible.
            const testRows = await prisma.$queryRaw<
                Array<{
                    programId: string
                    weekNumber: number
                    plannedTestsCount: number
                    completedTestsCount: number
                }>
            >`
                WITH test_week_workout_stats AS (
                    SELECT
                        w."programId",
                        w."weekNumber",
                        wk."id" AS workout_id,
                        COUNT(we."id") AS exercise_count,
                        CASE
                            WHEN COUNT(we."id") > 0
                                AND COUNT(we."id") = COUNT(DISTINCT CASE WHEN ef."id" IS NOT NULL THEN we."id" END)
                            THEN 1
                            ELSE 0
                        END AS is_complete
                    FROM "weeks" w
                    LEFT JOIN "workouts" wk ON wk."weekId" = w."id"
                    LEFT JOIN "workout_exercises" we ON we."workoutId" = wk."id"
                    LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id"
                    WHERE w."programId" IN (${programIdSql})
                        AND w."weekType" = 'test'
                    GROUP BY w."programId", w."weekNumber", wk."id"
                )
                SELECT
                    "programId",
                    "weekNumber",
                    COUNT(workout_id) FILTER (WHERE exercise_count > 0)::int AS "plannedTestsCount",
                    COALESCE(SUM(is_complete), 0)::int AS "completedTestsCount"
                FROM test_week_workout_stats
                GROUP BY "programId", "weekNumber"
                ORDER BY "programId", "weekNumber"
            `

            for (const row of testRows) {
                let summary = testsSummaryByProgramId.get(row.programId)
                if (!summary) {
                    summary = {
                        testWeeks: [],
                        testWeekSummaries: [],
                        hasTestWeeks: false,
                        testsCompleted: false,
                        plannedTestsCount: 0,
                        completedTestsCount: 0,
                    }
                    testsSummaryByProgramId.set(row.programId, summary)
                }
                summary.testWeeks.push(row.weekNumber)
                summary.testWeekSummaries.push({
                    weekNumber: row.weekNumber,
                    plannedTestsCount: row.plannedTestsCount,
                    completedTestsCount: row.completedTestsCount,
                    completed:
                        row.plannedTestsCount > 0 &&
                        row.completedTestsCount === row.plannedTestsCount,
                })
                summary.plannedTestsCount += row.plannedTestsCount
                summary.completedTestsCount += row.completedTestsCount
                summary.hasTestWeeks = true
            }

            for (const summary of testsSummaryByProgramId.values()) {
                summary.testsCompleted =
                    summary.testWeekSummaries.length > 0 &&
                    summary.testWeekSummaries.every((week) => week.completed)
            }
        }

        const enrichedItems = items
            .map((program) => {
                const completionSnapshot = completionByProgramId.get(program.id)
                const testsSummary = testsSummaryByProgramId.get(program.id)

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
                    testWeeks: testsSummary?.testWeeks ?? [],
                    testWeekSummaries: testsSummary?.testWeekSummaries ?? [],
                    hasTestWeeks: testsSummary?.hasTestWeeks ?? false,
                    testsCompleted: testsSummary?.testsCompleted ?? false,
                    plannedTestsCount: testsSummary?.plannedTestsCount ?? 0,
                    completedTestsCount: testsSummary?.completedTestsCount ?? 0,
                }
            })

        return apiSuccess({
            items: enrichedItems,
            pagination: {
                nextCursor,
                hasMore,
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

        const { title, traineeId, isSbdProgram, durationWeeks, workoutsPerWeek } = validation.data

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
        const weeksData = []
        for (let i = 1; i <= durationWeeks; i++) {
            const workoutsData = []
            for (let j = 1; j <= workoutsPerWeek; j++) {
                workoutsData.push({
                    dayIndex: j,
                })
            }

            weeksData.push({
                weekNumber: i,
                weekType: 'normal' as const,
                workouts: {
                    create: workoutsData,
                },
            })
        }

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

        const program = await prisma.trainingProgram.create({
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

        logger.info(
            {
                programId: program.id,
                trainerId: program.trainerId,
                traineeId: program.traineeId,
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

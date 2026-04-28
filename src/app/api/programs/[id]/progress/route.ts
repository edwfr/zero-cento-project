import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

interface CompletionRow {
    workoutId: string
    weekNumber: number
    exerciseCount: number
    completedExerciseCount: number
    startedFeedbackCount: number
}

interface WeeklyVolumeRow {
    weekNumber: number
    totalVolume: number
}

interface PerformedSetRow {
    setNumber: number
    reps: number
    weight: number
    completed: boolean
    feedback: {
        workoutExerciseId: string
        workoutExercise: { workoutId: string }
    }
}

/**
 * GET /api/programs/[id]/progress
 * Get program progress and statistics using SQL aggregates
 * Response: currentWeek, totalWeeks, completedWorkouts, totalWorkouts, feedbackCount, avgRPE, totalVolume
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                durationWeeks: true,
                trainerId: true,
                traineeId: true,
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403, undefined, 'program.viewDenied')
        }
        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view programs assigned to you', 403, undefined, 'program.viewAssignedDenied')
        }

        let currentWeek = 1
        if (program.startDate && program.status === 'active') {
            const today = new Date()
            const daysSinceStart = Math.floor(
                (today.getTime() - new Date(program.startDate).getTime()) / (1000 * 60 * 60 * 24)
            )
            currentWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, program.durationWeeks)
        }

        const workouts = await prisma.workout.findMany({
            where: { week: { programId } },
            select: {
                id: true,
                dayIndex: true,
                week: { select: { weekNumber: true, weekType: true } },
            },
            orderBy: [{ week: { weekNumber: 'asc' } }, { dayIndex: 'asc' }],
        })

        const completionRows = await prisma.$queryRaw<CompletionRow[]>`
            SELECT
                wk."id" AS "workoutId",
                w."weekNumber" AS "weekNumber",
                COUNT(we."id")::int AS "exerciseCount",
                COUNT(DISTINCT CASE WHEN ef."completed" THEN we."id" END)::int AS "completedExerciseCount",
                COUNT(DISTINCT CASE
                    WHEN EXISTS (
                        SELECT 1 FROM "sets_performed" sp
                        WHERE sp."feedbackId" = ef."id" AND sp."completed" = true
                    ) THEN we."id"
                END)::int AS "startedFeedbackCount"
            FROM "workouts" wk
            JOIN "weeks" w ON w."id" = wk."weekId"
            LEFT JOIN "workout_exercises" we ON we."workoutId" = wk."id"
            LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id"
            WHERE w."programId" = ${programId}
            GROUP BY wk."id", w."weekNumber"
        `

        const weeklyVolumeRows = await prisma.$queryRaw<WeeklyVolumeRow[]>`
            SELECT
                w."weekNumber" AS "weekNumber",
                COALESCE(SUM(sp."reps" * sp."weight"), 0)::int AS "totalVolume"
            FROM "weeks" w
            LEFT JOIN "workouts" wk ON wk."weekId" = w."id"
            LEFT JOIN "workout_exercises" we ON we."workoutId" = wk."id"
            LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id" AND ef."completed" = true
            LEFT JOIN "sets_performed" sp ON sp."feedbackId" = ef."id"
            WHERE w."programId" = ${programId}
            GROUP BY w."weekNumber"
            ORDER BY w."weekNumber" ASC
        `

        const programAgg = await prisma.exerciseFeedback.aggregate({
            where: {
                workoutExercise: { workout: { week: { programId } } },
                completed: true,
            },
            _avg: { actualRpe: true },
            _count: { _all: true },
        })

        const performedRows = await prisma.setPerformed.findMany({
            where: {
                completed: true,
                feedback: {
                    completed: true,
                    workoutExercise: { workout: { week: { programId } } },
                },
            },
            select: {
                setNumber: true,
                reps: true,
                weight: true,
                completed: true,
                feedback: {
                    select: {
                        workoutExerciseId: true,
                        workoutExercise: { select: { workoutId: true } },
                    },
                },
            },
            orderBy: [{ feedback: { date: 'desc' } }, { setNumber: 'asc' }],
        }) as unknown as PerformedSetRow[]

        // De-dup: keep set rows from the most recent completed feedback per workoutExerciseId.
        const exercisesPerformedMap = new Map<string, Map<string, { setNumber: number; reps: number; weight: number }[]>>()
        const seenWorkoutExerciseIds = new Set<string>()
        for (const row of performedRows) {
            const weId = row.feedback.workoutExerciseId
            const workoutId = row.feedback.workoutExercise.workoutId

            if (seenWorkoutExerciseIds.has(weId) === false) {
                if (!exercisesPerformedMap.has(workoutId)) {
                    exercisesPerformedMap.set(workoutId, new Map())
                }
                exercisesPerformedMap.get(workoutId)!.set(weId, [])
            }

            // Continue collecting only if this is the first feedback we saw for this exercise.
            const map = exercisesPerformedMap.get(workoutId)!.get(weId)
            if (map) {
                map.push({ setNumber: row.setNumber, reps: row.reps, weight: row.weight })
            }
            seenWorkoutExerciseIds.add(weId)
        }
        // Sort sets per (workout, exercise) by setNumber ascending.
        for (const exMap of exercisesPerformedMap.values()) {
            for (const sets of exMap.values()) {
                sets.sort((a, b) => a.setNumber - b.setNumber)
            }
        }

        const completionByWorkout = new Map(completionRows.map((r) => [r.workoutId, r]))

        const workoutsList = workouts.map((wk) => {
            const completion = completionByWorkout.get(wk.id)
            const exerciseCount = completion?.exerciseCount ?? 0
            const completedExerciseCount = completion?.completedExerciseCount ?? 0
            const startedFeedbackCount = completion?.startedFeedbackCount ?? 0
            const completed = exerciseCount > 0 && exerciseCount === completedExerciseCount
            const started = startedFeedbackCount > 0

            const exercisesPerformedForWorkout = exercisesPerformedMap.get(wk.id) ?? new Map()
            const exercisesPerformed = Array.from(exercisesPerformedForWorkout.entries()).map(
                ([workoutExerciseId, performedSets]) => ({ workoutExerciseId, performedSets })
            )

            return {
                id: wk.id,
                name: `Giorno ${wk.dayIndex}`,
                weekNumber: wk.week.weekNumber,
                weekType: wk.week.weekType,
                dayOfWeek: wk.dayIndex,
                exerciseCount,
                completed,
                started,
                feedbackCount: startedFeedbackCount,
                exercisesPerformed,
            }
        })

        const totalWorkouts = workoutsList.filter((w) => w.exerciseCount > 0).length
        const completedWorkouts = workoutsList.filter((w) => w.completed).length
        const feedbackCount = workoutsList.reduce((sum, w) => sum + w.feedbackCount, 0)
        const totalVolume = weeklyVolumeRows.reduce((sum, r) => sum + r.totalVolume, 0)
        const avgRPE = programAgg._avg.actualRpe !== null
            ? Math.round(programAgg._avg.actualRpe * 10) / 10
            : null

        const nextWorkout = workoutsList.find((w) => !w.completed) ?? null

        // Per-week aggregates: combine workouts grouped by weekNumber + weekly volume + per-week avg RPE.
        const byWeek = new Map<number, { weekType: string; workouts: typeof workoutsList }>()
        for (const w of workoutsList) {
            if (!byWeek.has(w.weekNumber)) {
                byWeek.set(w.weekNumber, { weekType: w.weekType, workouts: [] })
            }
            byWeek.get(w.weekNumber)!.workouts.push(w)
        }

        const weekRpeRows = await prisma.$queryRaw<Array<{ weekNumber: number; avgRpe: number | null; feedbackCount: number }>>`
            SELECT
                w."weekNumber" AS "weekNumber",
                AVG(ef."actualRpe")::float AS "avgRpe",
                COUNT(ef."id")::int AS "feedbackCount"
            FROM "weeks" w
            LEFT JOIN "workouts" wk ON wk."weekId" = w."id"
            LEFT JOIN "workout_exercises" we ON we."workoutId" = wk."id"
            LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id" AND ef."completed" = true
            WHERE w."programId" = ${programId}
            GROUP BY w."weekNumber"
        `
        const rpeByWeek = new Map(weekRpeRows.map((r) => [r.weekNumber, r]))
        const volumeByWeek = new Map(weeklyVolumeRows.map((r) => [r.weekNumber, r.totalVolume]))

        const weeklyStats = Array.from(byWeek.entries())
            .sort(([a], [b]) => a - b)
            .map(([weekNumber, info]) => ({
                weekNumber,
                weekType: info.weekType,
                totalVolume: volumeByWeek.get(weekNumber) ?? 0,
                avgRPE: rpeByWeek.get(weekNumber)?.avgRpe != null
                    ? Math.round(rpeByWeek.get(weekNumber)!.avgRpe! * 10) / 10
                    : null,
                completedWorkouts: info.workouts.filter((w) => w.completed).length,
                totalWorkouts: info.workouts.length,
                feedbackCount: rpeByWeek.get(weekNumber)?.feedbackCount ?? 0,
            }))

        return apiSuccess({
            programId: program.id,
            programName: program.title,
            status: program.status,
            currentWeek,
            totalWeeks: program.durationWeeks,
            completedWorkouts,
            totalWorkouts,
            feedbackCount,
            avgRPE,
            totalVolume,
            nextWorkout,
            workouts: workoutsList,
            weeklyStats,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error fetching program progress')
        return apiError('INTERNAL_ERROR', 'Failed to fetch program progress', 500, undefined, 'internal.default')
    }
}

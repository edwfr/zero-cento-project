import { prisma } from './prisma'
import { loadTraineePrMap, resolveEffectiveWeight } from './calculations'
import { logger } from './logger'

export interface TraineeProgramView {
    program: TraineeProgram
    progress: TraineeProgramProgress
}

export interface TraineeProgram {
    id: string
    title: string
    startDate: Date | null
    durationWeeks: number
    trainee: { firstName: string; lastName: string }
    trainer: { firstName: string; lastName: string }
    weeks: Array<{
        weekNumber: number
        weekType: 'normal' | 'test' | 'deload'
        workouts: Array<{
            id: string
            dayIndex: number
            workoutExercises: Array<{
                id: string
                workoutId: string
                exerciseId: string
                variant: string | null
                sets: number
                reps: string
                targetRpe: number | null
                weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
                weight: number | null
                effectiveWeight: number | null
                restTime: 's30' | 'm1' | 'm2' | 'm3' | 'm5'
                isWarmup: boolean
                isSkeletonExercise: boolean
                notes: string | null
                order: number
                exercise: { id: string; name: string; type: 'fundamental' | 'accessory' }
            }>
        }>
    }>
}

export interface TraineeProgramProgress {
    programId: string
    programName: string
    status: string
    currentWeek: number
    totalWeeks: number
    completedWorkouts: number
    totalWorkouts: number
    feedbackCount: number
    avgRPE: number | null
    totalVolume: number
    nextWorkout: WorkoutEntry | null
    workouts: WorkoutEntry[]
    weeklyStats: Array<{
        weekNumber: number
        weekType: string
        totalVolume: number
        avgRPE: number | null
        completedWorkouts: number
        totalWorkouts: number
        feedbackCount: number
    }>
}

interface WorkoutEntry {
    id: string
    name: string
    weekNumber: number
    weekType: string
    dayOfWeek: number
    exerciseCount: number
    completed: boolean
    started: boolean
    feedbackCount: number
    exercisesPerformed: Array<{
        workoutExerciseId: string
        performedSets: Array<{ setNumber: number; reps: number; weight: number }>
    }>
}

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

export async function loadActiveProgramId(
    traineeId: string,
    preferredProgramId?: string | null
): Promise<string | null> {
    if (preferredProgramId) {
        const preferredProgram = await prisma.trainingProgram.findFirst({
            where: { id: preferredProgramId, traineeId, status: 'active' },
            select: { id: true },
        })

        if (preferredProgram) {
            return preferredProgram.id
        }
    }

    const program = await prisma.trainingProgram.findFirst({
        where: { traineeId, status: 'active' },
        select: { id: true },
        orderBy: { startDate: 'desc' },
    })

    return program?.id ?? null
}

export async function loadTraineeProgramView(input: {
    programId: string
    traineeId: string
}): Promise<TraineeProgramView | null> {
    const { programId, traineeId } = input

    // Check if program exists and belongs to trainee first
    const programRaw = await loadProgramTreeForTrainee(programId, traineeId)
    if (!programRaw) {
        return null
    }

    // Once verified, load progress in parallel
    const progress = await loadProgressAggregates(programId)

    return { program: programRaw, progress }
}

async function loadProgramTreeForTrainee(
    programId: string,
    traineeId: string
): Promise<TraineeProgram | null> {
    const program = await prisma.trainingProgram.findUnique({
        where: { id: programId },
        include: {
            trainer: { select: { firstName: true, lastName: true } },
            trainee: { select: { firstName: true, lastName: true } },
            weeks: {
                include: {
                    workouts: {
                        include: {
                            workoutExercises: {
                                include: {
                                    exercise: { select: { id: true, name: true, type: true } },
                                },
                                orderBy: { order: 'asc' },
                            },
                        },
                    },
                },
                orderBy: { weekNumber: 'asc' },
            },
        },
    })

    if (!program || program.traineeId !== traineeId) {
        return null
    }

    const needsPrMap = program.weeks.some((week) =>
        week.workouts.some((workout) =>
            workout.workoutExercises.some((we) => we.weightType !== 'absolute')
        )
    )
    const prMap = needsPrMap ? await loadTraineePrMap(traineeId) : new Map<string, number>()

    const weeks = program.weeks.map((week) => ({
        weekNumber: week.weekNumber,
        weekType: week.weekType as 'normal' | 'test' | 'deload',
        workouts: week.workouts.map((workout) => {
            const siblings = workout.workoutExercises
            return {
                id: workout.id,
                dayIndex: workout.dayIndex,
                workoutExercises: workout.workoutExercises.map((we) => {
                    const base = {
                        id: we.id,
                        workoutId: we.workoutId,
                        exerciseId: we.exerciseId,
                        variant: we.variant,
                        sets: we.sets,
                        reps: we.reps,
                        targetRpe: we.targetRpe,
                        weightType: we.weightType,
                        weight: we.weight,
                        effectiveWeight: we.effectiveWeight,
                        restTime: we.restTime,
                        isWarmup: we.isWarmup,
                        isSkeletonExercise: we.isSkeletonExercise,
                        notes: we.notes,
                        order: we.order,
                        exercise: we.exercise,
                    }
                    if (typeof base.effectiveWeight === 'number') return base
                    if (base.weightType === 'absolute') return { ...base, effectiveWeight: base.weight }
                    try {
                        const effectiveWeight = resolveEffectiveWeight(we as any, prMap, siblings as any)
                        return { ...base, effectiveWeight }
                    } catch (err) {
                        logger.warn(
                            { programId, workoutExerciseId: we.id, error: err instanceof Error ? err.message : String(err) },
                            'Failed to resolve effective weight'
                        )
                        return { ...base, effectiveWeight: null }
                    }
                }),
            }
        }),
    }))

    return {
        id: program.id,
        title: program.title,
        startDate: program.startDate,
        durationWeeks: program.durationWeeks,
        trainee: program.trainee,
        trainer: program.trainer,
        weeks,
    }
}

export async function loadProgressAggregates(programId: string): Promise<TraineeProgramProgress> {
    const program = await prisma.trainingProgram.findUnique({
        where: { id: programId },
        select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            durationWeeks: true,
        },
    })

    if (!program) {
        throw new Error('Program not found')
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
            COUNT(DISTINCT we."id")::int AS "exerciseCount",
            COUNT(DISTINCT CASE WHEN ef."id" IS NOT NULL THEN we."id" END)::int AS "completedExerciseCount",
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
        LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id"
        LEFT JOIN "sets_performed" sp ON sp."feedbackId" = ef."id"
        WHERE w."programId" = ${programId}
        GROUP BY w."weekNumber"
        ORDER BY w."weekNumber" ASC
    `

    const programAgg = await prisma.exerciseFeedback.aggregate({
        where: {
            workoutExercise: { workout: { week: { programId } } },
        },
        _avg: { actualRpe: true },
        _count: { _all: true },
    })

    const performedRows = await prisma.setPerformed.findMany({
        where: {
            completed: true,
            feedback: {
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
        LEFT JOIN "exercise_feedbacks" ef ON ef."workoutExerciseId" = we."id"
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

    return {
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
    }
}

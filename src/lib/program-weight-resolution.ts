import { logger } from '@/lib/logger'
import { loadLatestBodyweightKg, loadTraineeOneRmMap, resolveEffectiveWeight } from '@/lib/calculations'
import { traineeWeightFields } from '@/lib/bodyweight-load'

/** Structural shape of the rows this helper reads; Prisma payloads satisfy it. */
interface ResolvableWorkoutExercise {
    id: string
    exerciseId: string
    weightType: string
    weight: number | null
    effectiveWeight: number | null
    rpeWeightMin?: number | null
    rpeWeightMax?: number | null
    exercise: unknown
}

interface ResolvableWeek {
    workouts: { workoutExercises: ResolvableWorkoutExercise[] }[]
}

const isLoaded = (we: ResolvableWorkoutExercise): boolean =>
    Boolean((we.exercise as { isBodyweightLoaded?: boolean } | null)?.isBodyweightLoaded)

/**
 * Resolves effective weights (and the ballast of bodyweight-loaded exercises)
 * of a program's weeks against a trainee's latest 1RM map and bodyweight.
 * Skips the 1RM read when every row is absolute and the bodyweight read when
 * no row is bodyweight-loaded.
 */
export async function resolveProgramWeeksForTrainee<TWeek extends ResolvableWeek>(
    weeks: TWeek[],
    traineeId: string,
    logContext: { programId: string }
): Promise<TWeek[]> {
    const needsPrMap = weeks.some((week) =>
        week.workouts.some((workout) =>
            workout.workoutExercises.some((we) => we.weightType !== 'absolute')
        )
    )

    const oneRmMap = needsPrMap ? await loadTraineeOneRmMap(traineeId) : new Map<string, number>()

    const loadedIds = new Set<string>()
    for (const week of weeks) {
        for (const workout of week.workouts) {
            for (const we of workout.workoutExercises) {
                if (isLoaded(we)) {
                    loadedIds.add(we.exerciseId)
                }
            }
        }
    }
    const bodyweightKg = loadedIds.size > 0 ? await loadLatestBodyweightKg(traineeId) : null
    const resolveOptions = {
        bodyweightKg,
        isBodyweightLoaded: (exerciseId: string) => loadedIds.has(exerciseId),
    }

    const resolvedWeeks = weeks.map((week) => ({
        ...week,
        workouts: week.workouts.map((workout) => {
            const siblings = workout.workoutExercises
            return {
                ...workout,
                workoutExercises: workout.workoutExercises.map((workoutExercise) => {
                    const withBallast = (effectiveWeight: number | null) => ({
                        ...workoutExercise,
                        ...traineeWeightFields(
                            {
                                weightType: workoutExercise.weightType as never,
                                weight: workoutExercise.weight,
                                effectiveWeight,
                                rpeWeightMin: workoutExercise.rpeWeightMin ?? null,
                                rpeWeightMax: workoutExercise.rpeWeightMax ?? null,
                                isBodyweightLoaded: isLoaded(workoutExercise),
                            },
                            bodyweightKg
                        ),
                    })

                    if (typeof workoutExercise.effectiveWeight === 'number') {
                        return withBallast(workoutExercise.effectiveWeight)
                    }

                    if (workoutExercise.weightType === 'absolute') {
                        return withBallast(workoutExercise.weight)
                    }

                    try {
                        const effectiveWeight = resolveEffectiveWeight(
                            workoutExercise as never,
                            oneRmMap,
                            siblings as never,
                            resolveOptions
                        )
                        return withBallast(effectiveWeight)
                    } catch (calculationError: unknown) {
                        logger.warn(
                            {
                                programId: logContext.programId,
                                workoutExerciseId: workoutExercise.id,
                                error:
                                    calculationError instanceof Error
                                        ? calculationError.message
                                        : String(calculationError),
                            },
                            'Failed to resolve effective weight while fetching program details'
                        )
                        return withBallast(null)
                    }
                }),
            }
        }),
    }))

    return resolvedWeeks as unknown as TWeek[]
}

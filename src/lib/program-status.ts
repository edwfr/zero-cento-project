export type ProgramStatus = 'draft' | 'active' | 'completed'

interface ProgramCompletionFeedback {
    date: Date
}

interface ProgramCompletionExercise {
    exerciseFeedbacks: ProgramCompletionFeedback[]
}

interface ProgramCompletionWorkout {
    workoutExercises: ProgramCompletionExercise[]
}

interface ProgramCompletionWeek {
    workouts: ProgramCompletionWorkout[]
}

interface ProgramCompletionProgram {
    status: ProgramStatus
    weeks: ProgramCompletionWeek[]
}

export interface ProgramCompletionSnapshot {
    totalWorkouts: number
    completedWorkouts: number
    lastCompletedWorkoutAt: Date | null
}

export const getProgramCompletionSnapshot = (
    program: ProgramCompletionProgram
): ProgramCompletionSnapshot => {
    const allWorkouts = program.weeks.flatMap((week) => week.workouts)

    let lastCompletedWorkoutAt: Date | null = null

    const completedWorkouts = allWorkouts.filter((workout) => {
        if (workout.workoutExercises.length === 0) {
            return false
        }

        const exerciseDates = workout.workoutExercises.map((exercise) => {
            if (exercise.exerciseFeedbacks.length === 0) {
                return null
            }
            return exercise.exerciseFeedbacks.reduce((latestDate, feedback) => {
                return feedback.date > latestDate ? feedback.date : latestDate
            }, exercise.exerciseFeedbacks[0].date)
        })

        if (exerciseDates.some((date) => date === null)) {
            return false
        }

        const workoutCompletionDates = exerciseDates.filter(
            (date): date is Date => date !== null
        )

        const workoutCompletedAt = workoutCompletionDates.reduce((latestDate, date) => {
            return date > latestDate ? date : latestDate
        }, workoutCompletionDates[0])

        if (lastCompletedWorkoutAt === null || workoutCompletedAt > lastCompletedWorkoutAt) {
            lastCompletedWorkoutAt = workoutCompletedAt
        }

        return true
    })

    return {
        totalWorkouts: allWorkouts.length,
        completedWorkouts: completedWorkouts.length,
        lastCompletedWorkoutAt,
    }
}

export const getEffectiveProgramStatus = (
    program: Pick<ProgramCompletionProgram, 'status'>,
    completionSnapshot?: ProgramCompletionSnapshot
): ProgramStatus => {
    if (program.status !== 'active' || !completionSnapshot) {
        return program.status
    }

    if (
        completionSnapshot.totalWorkouts > 0 &&
        completionSnapshot.completedWorkouts === completionSnapshot.totalWorkouts
    ) {
        return 'completed'
    }

    return 'active'
}

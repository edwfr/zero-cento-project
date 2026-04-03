export type ProgramStatus = 'draft' | 'active' | 'completed'

interface ProgramCompletionFeedback {
    completed: boolean
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

        const completedFeedbackDates = workout.workoutExercises.map((exercise) => {
            const completedFeedbacks = exercise.exerciseFeedbacks.filter((feedback) => feedback.completed)

            if (completedFeedbacks.length === 0) {
                return null
            }

            return completedFeedbacks.reduce((latestDate, feedback) => {
                return feedback.date > latestDate ? feedback.date : latestDate
            }, completedFeedbacks[0].date)
        })

        if (completedFeedbackDates.some((date) => date === null)) {
            return false
        }

        const workoutCompletedAt = completedFeedbackDates.reduce((latestDate, date) => {
            return date! > latestDate ? date! : latestDate
        }, completedFeedbackDates[0]!)

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

import { prisma } from '@/lib/prisma'

/**
 * Returns true if a workout has been started by the trainee.
 *
 * A workout is considered "started" when at least one SetPerformed with
 * completed=true exists for any WorkoutExercise belonging to that workout.
 * This criterion is consistent with the `started` flag used in
 * src/lib/trainee-program-data.ts.
 */
export async function hasWorkoutStarted(workoutId: string): Promise<boolean> {
    const count = await prisma.setPerformed.count({
        where: {
            completed: true,
            feedback: {
                workoutExercise: { workoutId },
            },
        },
    })
    return count > 0
}

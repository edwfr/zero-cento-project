import { prisma } from '@/lib/prisma'
import { ProgramStatus } from '@prisma/client'

/**
 * Result of cascading a completion state change from WorkoutExercise upward
 * through Workout → Week → TrainingProgram hierarchy.
 *
 * Contains the updated isCompleted state at each level, plus the program status
 * (draft | active | completed).
 */
export interface CascadeResult {
  workoutExercise: { id: string; isCompleted: boolean }
  workout: { id: string; isCompleted: boolean }
  week: { id: string; isCompleted: boolean }
  program: { id: string; status: ProgramStatus }
}

/**
 * Atomically cascade a completion state change from a single WorkoutExercise
 * up through the hierarchy (Workout → Week → TrainingProgram).
 *
 * **Pattern:** Interactive transaction with guarded conditional updates.
 * Only updates a parent level if its completion state actually changes,
 * reducing unnecessary DB writes.
 *
 * **Cascade rules:**
 * - WorkoutExercise marked → if ALL exercises in workout are completed → Workout completes
 * - Workout completed → if ALL workouts in week are completed → Week completes
 * - Week completed → if ALL weeks in program are completed → Program status → 'completed'
 *
 * **De-completion (reverse cascade):**
 * - WorkoutExercise unmarked → Workout auto-reverts to incomplete (if it was complete)
 * - Cascade continues upward, reverting Week and Program as needed
 * - Program reverts to 'active' (unless in 'draft' — untouched)
 *
 * @param workoutExerciseId - UUID of the WorkoutExercise to toggle
 * @param isCompleted - New completion state (true = mark as done, false = unmark)
 * @returns CascadeResult with updated states at all levels
 * @throws {Error} If workoutExerciseId not found, or DB transaction fails
 */
export async function cascadeCompletion(
  workoutExerciseId: string,
  isCompleted: boolean
): Promise<CascadeResult> {
  const result = await prisma.$transaction(
    async (tx) => {
      // ===== STEP 1: Update WorkoutExercise =====
      const updatedExercise = await tx.workoutExercise.update({
        where: { id: workoutExerciseId },
        data: { isCompleted },
        select: { id: true, workoutId: true },
      })

      const workoutId = updatedExercise.workoutId

      // ===== STEP 2: Determine if Workout should be completed =====
      // Count incomplete exercises in this workout
      const incompleteCount = await tx.workoutExercise.count({
        where: { workoutId, isCompleted: false },
      })
      const totalCount = await tx.workoutExercise.count({
        where: { workoutId },
      })

      // Guard: workout can only be complete if it has exercises AND all are done
      const workoutIsCompleted = totalCount > 0 && incompleteCount === 0

      // Fetch current state to avoid unnecessary updates
      const currentWorkout = await tx.workout.findUnique({
        where: { id: workoutId },
        select: { id: true, weekId: true, isCompleted: true },
      })

      if (!currentWorkout) {
        throw new Error(`Workout not found: ${workoutId}`)
      }

      // Only update if state changes
      let updatedWorkout = currentWorkout
      if (currentWorkout.isCompleted !== workoutIsCompleted) {
        updatedWorkout = await tx.workout.update({
          where: { id: workoutId },
          data: { isCompleted: workoutIsCompleted },
          select: { id: true, weekId: true, isCompleted: true },
        })
      }

      const weekId = updatedWorkout.weekId

      // ===== STEP 3: Determine if Week should be completed =====
      const incompleteWorkoutCount = await tx.workout.count({
        where: { weekId, isCompleted: false },
      })
      const totalWorkoutCount = await tx.workout.count({
        where: { weekId },
      })

      const weekIsCompleted = totalWorkoutCount > 0 && incompleteWorkoutCount === 0

      const currentWeek = await tx.week.findUnique({
        where: { id: weekId },
        select: { id: true, programId: true, isCompleted: true },
      })

      if (!currentWeek) {
        throw new Error(`Week not found: ${weekId}`)
      }

      let updatedWeek = currentWeek
      if (currentWeek.isCompleted !== weekIsCompleted) {
        updatedWeek = await tx.week.update({
          where: { id: weekId },
          data: { isCompleted: weekIsCompleted },
          select: { id: true, programId: true, isCompleted: true },
        })
      }

      const programId = updatedWeek.programId

      // ===== STEP 4: Determine if Program should be completed =====
      const incompleteWeekCount = await tx.week.count({
        where: { programId, isCompleted: false },
      })
      const totalWeekCount = await tx.week.count({
        where: { programId },
      })

      const programIsCompleted = totalWeekCount > 0 && incompleteWeekCount === 0

      const currentProgram = await tx.trainingProgram.findUnique({
        where: { id: programId },
        select: { id: true, status: true },
      })

      if (!currentProgram) {
        throw new Error(`TrainingProgram not found: ${programId}`)
      }

      // Determine new program status
      let newProgramStatus = currentProgram.status
      if (programIsCompleted && currentProgram.status !== 'draft') {
        // Mark program as completed
        newProgramStatus = 'completed'
      } else if (!programIsCompleted && currentProgram.status === 'completed') {
        // Revert program to active (if it was completed due to missing exercises)
        newProgramStatus = 'active'
      }

      let updatedProgram = currentProgram
      if (
        currentProgram.status !== newProgramStatus ||
        (programIsCompleted && currentProgram.status !== 'draft')
      ) {
        updatedProgram = await tx.trainingProgram.update({
          where: { id: programId },
          data: {
            status: newProgramStatus,
            completedAt: newProgramStatus === 'completed' ? new Date() : null,
          },
          select: { id: true, status: true },
        })
      }

      return {
        workoutExercise: {
          id: updatedExercise.id,
          isCompleted,
        },
        workout: {
          id: updatedWorkout.id,
          isCompleted: updatedWorkout.isCompleted,
        },
        week: {
          id: updatedWeek.id,
          isCompleted: updatedWeek.isCompleted,
        },
        program: {
          id: updatedProgram.id,
          status: updatedProgram.status,
        },
      }
    },
    {
      // Ensure max timeout to prevent long-running transactions
      timeout: 10000,
    }
  )

  return result
}

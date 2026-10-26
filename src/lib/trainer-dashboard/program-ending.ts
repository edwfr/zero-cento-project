import { prisma } from '@/lib/prisma'
import { PROGRAM_ENDING_DAYS } from './constants'
import { addDays, programEndDate, startOfUtcDay, wholeDaysBetween } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface EndingProgram {
    programId: string
    traineeId: string
    traineeName: string
    programTitle: string
    days: number
    /** Already completed (the trainee finished every week, or the trainer closed it) */
    finished: boolean
    /** Workouts of the last week with every exercise completed */
    completed: number
    /** Workouts of the last week with at least one exercise */
    planned: number
}

export async function getEndingPrograms(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<EndingProgram[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const today = startOfUtcDay(now)

    // A program auto-completes when the trainee finishes its last workout: keep it listed for
    // PROGRAM_ENDING_DAYS after that, since that is exactly when the trainer needs the next one.
    const programs = await prisma.trainingProgram.findMany({
        where: {
            trainerId,
            traineeId: { in: traineeIds },
            OR: [
                { status: { in: ['draft', 'active'] } },
                { status: 'completed', completedAt: { gte: addDays(today, -PROGRAM_ENDING_DAYS) } },
            ],
        },
        select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            durationWeeks: true,
            completedAt: true,
            traineeId: true,
            trainee: { select: { firstName: true, lastName: true } },
            weeks: {
                orderBy: { weekNumber: 'desc' },
                take: 1,
                select: { workouts: { select: { workoutExercises: { select: { isCompleted: true } } } } },
            },
        },
    })

    const openPrograms = programs.filter((program) => program.status !== 'completed')
    const items: EndingProgram[] = []

    for (const program of programs) {
        const finished = program.status === 'completed'
        let daysLeft = 0

        if (finished) {
            // Only the trainee's latest completed program: an older one is already superseded
            const newerFinished = programs.some(
                (other) =>
                    other.status === 'completed' &&
                    other.traineeId === program.traineeId &&
                    other.id !== program.id &&
                    (other.completedAt?.getTime() ?? 0) > (program.completedAt?.getTime() ?? 0),
            )
            if (newerFinished) continue
        } else {
            if (program.status !== 'active' || !program.startDate) continue

            // programEndDate is exclusive: count down to the last training day, so the last day reads "today"
            daysLeft = wholeDaysBetween(today, programEndDate(program.startDate, program.durationWeeks)) - 1
            if (daysLeft > PROGRAM_ENDING_DAYS) continue
        }

        const hasSuccessor = openPrograms.some((other) => other.traineeId === program.traineeId && other.id !== program.id)
        if (hasSuccessor) continue

        const plannedWorkouts = (program.weeks[0]?.workouts ?? []).filter((workout) => workout.workoutExercises.length > 0)

        items.push({
            programId: program.id,
            traineeId: program.traineeId,
            traineeName: fullName(program.trainee),
            programTitle: program.title,
            days: Math.max(0, daysLeft),
            finished,
            completed: plannedWorkouts.filter((workout) => workout.workoutExercises.every((exercise) => exercise.isCompleted)).length,
            planned: plannedWorkouts.length,
        })
    }

    // Finished programs first: their trainee is already waiting for the next one
    return items.sort(
        (left, right) =>
            Number(right.finished) - Number(left.finished) ||
            left.days - right.days ||
            left.traineeName.localeCompare(right.traineeName),
    )
}

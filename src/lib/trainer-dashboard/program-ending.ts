import { prisma } from '@/lib/prisma'
import { PROGRAM_ENDING_DAYS } from './constants'
import { programEndDate, startOfUtcDay, wholeDaysBetween } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface EndingProgram {
    programId: string
    traineeId: string
    traineeName: string
    programTitle: string
    days: number
    /** Workouts of the last week with every exercise completed */
    completed: number
    /** Workouts of the last week with at least one exercise */
    planned: number
}

export async function getEndingPrograms(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<EndingProgram[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const today = startOfUtcDay(now)

    const openPrograms = await prisma.trainingProgram.findMany({
        where: { trainerId, status: { in: ['draft', 'active'] }, traineeId: { in: traineeIds } },
        select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            durationWeeks: true,
            traineeId: true,
            trainee: { select: { firstName: true, lastName: true } },
            weeks: {
                orderBy: { weekNumber: 'desc' },
                take: 1,
                select: { workouts: { select: { workoutExercises: { select: { isCompleted: true } } } } },
            },
        },
    })

    const items: EndingProgram[] = []

    for (const program of openPrograms) {
        if (program.status !== 'active' || !program.startDate) continue

        // programEndDate is exclusive: count down to the last training day, so the last day reads "today"
        const daysLeft = wholeDaysBetween(today, programEndDate(program.startDate, program.durationWeeks)) - 1
        if (daysLeft > PROGRAM_ENDING_DAYS) continue

        const hasSuccessor = openPrograms.some((other) => other.traineeId === program.traineeId && other.id !== program.id)
        if (hasSuccessor) continue

        const plannedWorkouts = (program.weeks[0]?.workouts ?? []).filter((workout) => workout.workoutExercises.length > 0)

        items.push({
            programId: program.id,
            traineeId: program.traineeId,
            traineeName: fullName(program.trainee),
            programTitle: program.title,
            days: Math.max(0, daysLeft),
            completed: plannedWorkouts.filter((workout) => workout.workoutExercises.every((exercise) => exercise.isCompleted)).length,
            planned: plannedWorkouts.length,
        })
    }

    return items.sort((left, right) => left.days - right.days || left.traineeName.localeCompare(right.traineeName))
}

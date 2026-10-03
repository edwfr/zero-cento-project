import { prisma } from '@/lib/prisma'
import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { PROGRAM_ENDING_DAYS } from './constants'
import { programEndDate, startOfUtcDay, startOfUtcWeek, wholeDaysBetween } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export type TodoItem =
    | { kind: 'subscriptionExpired'; traineeId: string; traineeName: string; days: number }
    | { kind: 'subscriptionExpiring'; traineeId: string; traineeName: string; days: number }
    | { kind: 'testsToReview'; programId: string; traineeName: string; weekNumber: number }
    | { kind: 'programEnding'; programId: string; traineeId: string; traineeName: string; programTitle: string; days: number }
    | { kind: 'testWeekInProgress'; programId: string; traineeName: string; weekNumber: number; completed: number; planned: number }

const PRIORITY: Record<TodoItem['kind'], number> = {
    subscriptionExpired: 0,
    subscriptionExpiring: 1,
    testsToReview: 2,
    programEnding: 3,
    testWeekInProgress: 4,
}

export async function getTodoItems(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<TodoItem[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const today = startOfUtcDay(now)

    const [overview, testWeeks, openPrograms] = await Promise.all([
        getTrainerSubscriptionOverview(trainerId, today),
        prisma.week.findMany({
            where: {
                weekType: 'test',
                startDate: { gte: startOfUtcWeek(now), lte: now },
                program: { trainerId, status: { in: ['active', 'completed'] }, traineeId: { in: traineeIds } },
            },
            select: {
                id: true,
                weekNumber: true,
                program: { select: { id: true, trainee: { select: { firstName: true, lastName: true } } } },
                workouts: { select: { workoutExercises: { select: { isCompleted: true } } } },
            },
        }),
        prisma.trainingProgram.findMany({
            where: { trainerId, status: { in: ['draft', 'active'] }, traineeId: { in: traineeIds } },
            select: {
                id: true,
                title: true,
                status: true,
                startDate: true,
                durationWeeks: true,
                traineeId: true,
                trainee: { select: { firstName: true, lastName: true } },
            },
        }),
    ])

    const items: TodoItem[] = []

    for (const entry of overview.withSubscription) {
        const traineeName = fullName(entry)
        if (entry.subscription.status === 'expired') {
            items.push({ kind: 'subscriptionExpired', traineeId: entry.traineeId, traineeName, days: -entry.subscription.daysLeft })
        } else if (entry.subscription.status === 'expiring') {
            items.push({ kind: 'subscriptionExpiring', traineeId: entry.traineeId, traineeName, days: entry.subscription.daysLeft })
        }
    }

    for (const week of testWeeks) {
        const plannedWorkouts = week.workouts.filter((workout) => workout.workoutExercises.length > 0)
        if (plannedWorkouts.length === 0) continue

        const completed = plannedWorkouts.filter((workout) =>
            workout.workoutExercises.every((exercise) => exercise.isCompleted),
        ).length
        const base = { programId: week.program.id, traineeName: fullName(week.program.trainee), weekNumber: week.weekNumber }

        items.push(
            completed === plannedWorkouts.length
                ? { kind: 'testsToReview', ...base }
                : { kind: 'testWeekInProgress', ...base, completed, planned: plannedWorkouts.length },
        )
    }

    for (const program of openPrograms) {
        if (program.status !== 'active' || !program.startDate) continue

        // programEndDate is exclusive: count down to the last training day, so the last day reads "today"
        const daysLeft = wholeDaysBetween(today, programEndDate(program.startDate, program.durationWeeks)) - 1
        if (daysLeft > PROGRAM_ENDING_DAYS) continue

        const hasSuccessor = openPrograms.some((other) => other.traineeId === program.traineeId && other.id !== program.id)
        if (hasSuccessor) continue

        items.push({
            kind: 'programEnding',
            programId: program.id,
            traineeId: program.traineeId,
            traineeName: fullName(program.trainee),
            programTitle: program.title,
            days: Math.max(0, daysLeft),
        })
    }

    return items.sort(
        (left, right) => PRIORITY[left.kind] - PRIORITY[right.kind] || left.traineeName.localeCompare(right.traineeName),
    )
}

import { prisma } from '@/lib/prisma'
import { LIST_LIMITS } from './constants'
import { recentWindowStart } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface NewRecordItem {
    id: string
    traineeName: string
    exerciseName: string
    reps: number
    weight: number
    recordDate: Date
    /** null for a first record of that lift and rep count */
    deltaKg: number | null
}

export async function getNewRecords(trainees: DashboardTrainee[], now: Date): Promise<NewRecordItem[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const recent = await prisma.personalRecord.findMany({
        where: { traineeId: { in: traineeIds }, recordDate: { gte: recentWindowStart(now) } },
        orderBy: { recordDate: 'desc' },
        take: LIST_LIMITS.records,
        select: {
            id: true,
            traineeId: true,
            exerciseId: true,
            reps: true,
            weight: true,
            recordDate: true,
            trainee: { select: { firstName: true, lastName: true } },
            exercise: { select: { name: true } },
        },
    })
    if (recent.length === 0) return []

    const previous = await prisma.personalRecord.findMany({
        where: {
            OR: recent.map((record) => ({
                traineeId: record.traineeId,
                exerciseId: record.exerciseId,
                reps: record.reps,
                recordDate: { lt: record.recordDate },
            })),
        },
        select: { traineeId: true, exerciseId: true, reps: true, weight: true, recordDate: true },
    })

    return recent.map((record) => {
        const earlier = previous.filter(
            (other) =>
                other.traineeId === record.traineeId &&
                other.exerciseId === record.exerciseId &&
                other.reps === record.reps &&
                other.recordDate < record.recordDate,
        )
        const bestBefore = earlier.length > 0 ? Math.max(...earlier.map((other) => other.weight)) : null

        return {
            id: record.id,
            traineeName: fullName(record.trainee),
            exerciseName: record.exercise.name,
            reps: record.reps,
            weight: record.weight,
            recordDate: record.recordDate,
            deltaKg: bestBefore === null ? null : Math.round((record.weight - bestBefore) * 10) / 10,
        }
    })
}

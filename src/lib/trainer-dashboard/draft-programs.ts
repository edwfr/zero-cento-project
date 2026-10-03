import { prisma } from '@/lib/prisma'
import { startOfUtcDay, wholeDaysBetween } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface DraftProgram {
    programId: string
    traineeName: string
    programTitle: string
    /** Calendar days since the draft was created: 0 today, 1 yesterday */
    daysSinceCreated: number
}

export async function getDraftPrograms(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<DraftProgram[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    // createdAt, not updatedAt: editing workouts and exercises does not touch the program row
    const drafts = await prisma.trainingProgram.findMany({
        where: { trainerId, status: 'draft', traineeId: { in: traineeIds } },
        select: { id: true, title: true, createdAt: true, trainee: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
    })

    const today = startOfUtcDay(now)

    return drafts.map((draft) => ({
        programId: draft.id,
        traineeName: fullName(draft.trainee),
        programTitle: draft.title,
        daysSinceCreated: Math.max(0, wholeDaysBetween(draft.createdAt, today)),
    }))
}

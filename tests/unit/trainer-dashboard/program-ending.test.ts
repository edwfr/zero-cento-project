import { describe, it, expect } from 'vitest'
import { getEndingPrograms } from '@/lib/trainer-dashboard/program-ending'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const program = (
    id: string,
    traineeId: string,
    status: 'draft' | 'active',
    startDate: Date | null,
    durationWeeks: number,
    lastWeek: boolean[][] | null = null,
) => ({
    id,
    title: `Prog ${id}`,
    status,
    startDate,
    durationWeeks,
    traineeId,
    trainee: { firstName: traineeId.toUpperCase(), lastName: 'X' },
    weeks: lastWeek
        ? [{ workouts: lastWeek.map((exercises) => ({ workoutExercises: exercises.map((isCompleted) => ({ isCompleted })) })) }]
        : [],
})

function arrange(programs: ReturnType<typeof program>[]) {
    prismaMock.trainingProgram.findMany.mockResolvedValue(programs as never)
}

describe('getEndingPrograms', () => {
    it('queries open programs of active trainees with the workouts of their last week', async () => {
        arrange([])

        await expect(getEndingPrograms('trainer-1', TRAINEES, NOW)).resolves.toEqual([])

        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', status: { in: ['draft', 'active'] }, traineeId: { in: ['t1', 't2'] } },
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
    })

    it('flags active programs ending within 7 days only when the trainee has no other open program', async () => {
        arrange([
            // last training day 2026-10-05 (2 days), no successor → flagged
            program('p1', 't1', 'active', at('2026-09-08T09:00:00'), 4),
            // last day 2026-09-28, still active, no successor → flagged with 0 days
            program('p2', 't2', 'active', day('2026-09-01'), 4),
            // ends 2026-10-06 but a draft follows → not flagged
            program('p3', 't3', 'active', day('2026-09-08'), 4),
            program('p4', 't3', 'draft', null, 4),
            // ends 2026-10-27 → too far
            program('p5', 't5', 'active', day('2026-09-08'), 7),
            // no start date → ignored
            program('p6', 't6', 'active', null, 1),
        ])

        await expect(getEndingPrograms('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            { programId: 'p2', traineeId: 't2', traineeName: 'T2 X', programTitle: 'Prog p2', days: 0, completed: 0, planned: 0 },
            { programId: 'p1', traineeId: 't1', traineeName: 'T1 X', programTitle: 'Prog p1', days: 2, completed: 0, planned: 0 },
        ])
    })

    it('counts down to the last training day: 0 on the last day, 1 the day before', async () => {
        arrange([
            // 4 weeks from 6 Sep: last training day is Sat 3 Oct (today)
            program('p1', 't1', 'active', day('2026-09-06'), 4),
            // 4 weeks from 7 Sep: last training day is Sun 4 Oct (tomorrow)
            program('p2', 't2', 'active', day('2026-09-07'), 4),
        ])

        const items = await getEndingPrograms('trainer-1', TRAINEES, NOW)

        expect(items.map((item) => `${item.programId}:${item.days}`)).toEqual(['p1:0', 'p2:1'])
    })

    it('measures last-week progress on workouts with exercises, counting only fully completed ones', async () => {
        arrange([program('p1', 't1', 'active', day('2026-09-08'), 4, [[true, true], [true, false], [false], []])])

        const [item] = await getEndingPrograms('trainer-1', TRAINEES, NOW)

        expect(item).toMatchObject({ completed: 1, planned: 3 })
    })

    it('orders by days left, then by trainee name', async () => {
        arrange([
            program('p1', 'zed', 'active', day('2026-09-08'), 4),
            program('p2', 'amy', 'active', day('2026-09-08'), 4),
            program('p3', 'bob', 'active', day('2026-09-06'), 4),
        ])

        const items = await getEndingPrograms('trainer-1', TRAINEES, NOW)

        expect(items.map((item) => item.traineeName)).toEqual(['BOB X', 'AMY X', 'ZED X'])
    })

    it('does not query without active trainees', async () => {
        await expect(getEndingPrograms('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(prismaMock.trainingProgram.findMany).not.toHaveBeenCalled()
    })
})

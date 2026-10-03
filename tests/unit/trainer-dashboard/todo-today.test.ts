import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/subscription-queries', () => ({ getTrainerSubscriptionOverview: vi.fn() }))

import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { getTodoItems } from '@/lib/trainer-dashboard/todo-today'
import type { SubscriptionOverview } from '@/lib/subscriptions'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const overview = (items: SubscriptionOverview['withSubscription']): SubscriptionOverview => ({
    withSubscription: items,
    withoutSubscription: [],
    counts: { none: 0, active: 0, expiring: 0, expired: 0 },
})

const subscribed = (traineeId: string, firstName: string, status: 'active' | 'expiring' | 'expired', daysLeft: number) => ({
    traineeId,
    firstName,
    lastName: 'X',
    subscription: { status, daysLeft, endDate: '2026-10-10T00:00:00.000Z' },
})

const testWeek = (id: string, programId: string, firstName: string, workouts: boolean[][]) => ({
    id,
    weekNumber: 4,
    program: { id: programId, trainee: { firstName, lastName: 'X' } },
    workouts: workouts.map((exercises) => ({ workoutExercises: exercises.map((isCompleted) => ({ isCompleted })) })),
})

const program = (
    id: string,
    traineeId: string,
    status: 'draft' | 'active',
    startDate: Date | null,
    durationWeeks: number,
) => ({ id, title: `Prog ${id}`, status, startDate, durationWeeks, traineeId, trainee: { firstName: traineeId.toUpperCase(), lastName: 'X' } })

function arrange({
    subscriptions = [],
    weeks = [],
    programs = [],
}: {
    subscriptions?: SubscriptionOverview['withSubscription']
    weeks?: ReturnType<typeof testWeek>[]
    programs?: ReturnType<typeof program>[]
}) {
    vi.mocked(getTrainerSubscriptionOverview).mockResolvedValue(overview(subscriptions))
    prismaMock.week.findMany.mockResolvedValue(weeks as never)
    prismaMock.trainingProgram.findMany.mockResolvedValue(programs as never)
}

describe('getTodoItems', () => {
    // module mocks keep their calls across tests; only prismaMock is reset by the shared setup
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('queries subscriptions for today, current test weeks and open programs', async () => {
        arrange({})

        await expect(getTodoItems('trainer-1', TRAINEES, NOW)).resolves.toEqual([])

        expect(getTrainerSubscriptionOverview).toHaveBeenCalledWith('trainer-1', day('2026-10-03'))
        expect(prismaMock.week.findMany).toHaveBeenCalledWith({
            where: {
                weekType: 'test',
                startDate: { gte: day('2026-09-28'), lte: NOW },
                program: { trainerId: 'trainer-1', status: { in: ['active', 'completed'] }, traineeId: { in: ['t1', 't2'] } },
            },
            select: {
                id: true,
                weekNumber: true,
                program: { select: { id: true, trainee: { select: { firstName: true, lastName: true } } } },
                workouts: { select: { workoutExercises: { select: { isCompleted: true } } } },
            },
        })
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
            },
        })
    })

    it('turns expired and expiring subscriptions into items, ignoring active ones', async () => {
        arrange({
            subscriptions: [
                subscribed('t1', 'Zoe', 'expired', -3),
                subscribed('t2', 'Bea', 'expiring', 0),
                subscribed('t3', 'Ada', 'active', 40),
            ],
        })

        await expect(getTodoItems('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            { kind: 'subscriptionExpired', traineeId: 't1', traineeName: 'Zoe X', days: 3 },
            { kind: 'subscriptionExpiring', traineeId: 't2', traineeName: 'Bea X', days: 0 },
        ])
    })

    it('splits test weeks into "to review" (all planned tests done) and "in progress"', async () => {
        arrange({
            weeks: [
                testWeek('wk1', 'p1', 'Done', [[true, true], [true], []]),
                testWeek('wk2', 'p2', 'Half', [[true], [false, true]]),
                testWeek('wk3', 'p3', 'Empty', [[], []]),
            ],
        })

        await expect(getTodoItems('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            { kind: 'testsToReview', programId: 'p1', traineeName: 'Done X', weekNumber: 4 },
            { kind: 'testWeekInProgress', programId: 'p2', traineeName: 'Half X', weekNumber: 4, completed: 1, planned: 2 },
        ])
    })

    it('flags active programs ending within 7 days only when the trainee has no other open program', async () => {
        arrange({
            programs: [
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
            ],
        })

        await expect(getTodoItems('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            { kind: 'programEnding', programId: 'p1', traineeId: 't1', traineeName: 'T1 X', programTitle: 'Prog p1', days: 2 },
            { kind: 'programEnding', programId: 'p2', traineeId: 't2', traineeName: 'T2 X', programTitle: 'Prog p2', days: 0 },
        ])
    })

    it('counts down to the last training day: 0 on the last day, 1 the day before', async () => {
        arrange({
            programs: [
                // 4 weeks from 6 Sep: last training day is Sat 3 Oct (today)
                program('p1', 't1', 'active', day('2026-09-06'), 4),
                // 4 weeks from 7 Sep: last training day is Sun 4 Oct (tomorrow)
                program('p2', 't2', 'active', day('2026-09-07'), 4),
            ],
        })

        const items = await getTodoItems('trainer-1', TRAINEES, NOW)

        expect(items.map((item) => (item.kind === 'programEnding' ? `${item.programId}:${item.days}` : item.kind))).toEqual(['p1:0', 'p2:1'])
    })

    it('does not query without active trainees', async () => {
        await expect(getTodoItems('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(getTrainerSubscriptionOverview).not.toHaveBeenCalled()
        expect(prismaMock.week.findMany).not.toHaveBeenCalled()
        expect(prismaMock.trainingProgram.findMany).not.toHaveBeenCalled()
    })

    it('orders by urgency, then by trainee name', async () => {
        arrange({
            subscriptions: [subscribed('t1', 'Zoe', 'expiring', 5), subscribed('t2', 'Ada', 'expiring', 9), subscribed('t3', 'Max', 'expired', -1)],
            weeks: [testWeek('wk1', 'p1', 'Bob', [[false]])],
        })

        const items = await getTodoItems('trainer-1', TRAINEES, NOW)

        expect(items.map((item) => `${item.kind}:${item.traineeName}`)).toEqual([
            'subscriptionExpired:Max X',
            'subscriptionExpiring:Ada X',
            'subscriptionExpiring:Zoe X',
            'testWeekInProgress:Bob X',
        ])
    })
})

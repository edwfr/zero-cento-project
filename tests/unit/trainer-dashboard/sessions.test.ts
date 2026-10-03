import { describe, it, expect } from 'vitest'
import { countSessionsBetween, groupSessions } from '@/lib/trainer-dashboard/sessions'
import { day, at } from './fixtures'

const row = (traineeId: string, workoutId: string, date: string, createdAt: string) => ({
    traineeId,
    date: day(date),
    createdAt: at(createdAt),
    workoutExercise: { workoutId },
})

describe('groupSessions', () => {
    it('merges feedback of the same trainee, workout and day into one session', () => {
        const sessions = groupSessions([
            row('t1', 'w1', '2026-10-02', '2026-10-02T17:00:00'),
            row('t1', 'w1', '2026-10-02', '2026-10-02T17:40:00'),
            row('t1', 'w1', '2026-10-02', '2026-10-02T17:20:00'),
        ])

        expect(sessions).toEqual([
            {
                key: 't1|w1|2026-10-02',
                traineeId: 't1',
                workoutId: 'w1',
                day: '2026-10-02',
                lastLoggedAt: at('2026-10-02T17:40:00'),
                exerciseCount: 3,
            },
        ])
    })

    it('splits by day (from the date key, not createdAt), by workout and by trainee, newest first', () => {
        const sessions = groupSessions([
            // logged just after midnight UTC but keyed on the previous day: still the 1 Oct session
            row('t1', 'w1', '2026-10-01', '2026-10-02T00:30:00'),
            row('t1', 'w1', '2026-10-03', '2026-10-03T08:00:00'),
            row('t1', 'w2', '2026-10-03', '2026-10-03T09:00:00'),
            row('t2', 'w2', '2026-10-03', '2026-10-03T07:00:00'),
        ])

        expect(sessions.map((s) => s.key)).toEqual([
            't1|w2|2026-10-03',
            't1|w1|2026-10-03',
            't2|w2|2026-10-03',
            't1|w1|2026-10-01',
        ])
    })

    it('returns an empty list for no rows', () => {
        expect(groupSessions([])).toEqual([])
    })
})

describe('countSessionsBetween', () => {
    it('counts sessions whose day is in [from, to)', () => {
        const sessions = groupSessions([
            row('t1', 'w1', '2026-09-27', '2026-09-27T10:00:00'),
            row('t1', 'w2', '2026-09-28', '2026-09-28T10:00:00'),
            row('t1', 'w3', '2026-10-04', '2026-10-04T10:00:00'),
            row('t1', 'w4', '2026-10-05', '2026-10-05T10:00:00'),
        ])

        expect(countSessionsBetween(sessions, day('2026-09-28'), day('2026-10-05'))).toBe(2)
    })
})

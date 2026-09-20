import { describe, it, expect } from 'vitest'
import { getProgramCompletionSnapshot, getEffectiveProgramStatus } from '@/lib/program-status'

const feedback = (iso: string) => ({ date: new Date(iso) })
const exercise = (...dates: string[]) => ({ exerciseFeedbacks: dates.map(feedback) })
const workout = (...exercises: ReturnType<typeof exercise>[]) => ({ workoutExercises: exercises })
const week = (...workouts: ReturnType<typeof workout>[]) => ({ workouts })

describe('getProgramCompletionSnapshot', () => {
    it('counts no workouts for a program without weeks', () => {
        const snapshot = getProgramCompletionSnapshot({ status: 'active', weeks: [] })

        expect(snapshot).toEqual({ totalWorkouts: 0, completedWorkouts: 0, lastCompletedWorkoutAt: null })
    })

    it('does not count a workout without exercises as completed', () => {
        const snapshot = getProgramCompletionSnapshot({ status: 'active', weeks: [week(workout())] })

        expect(snapshot.totalWorkouts).toBe(1)
        expect(snapshot.completedWorkouts).toBe(0)
        expect(snapshot.lastCompletedWorkoutAt).toBeNull()
    })

    it('does not count a workout whose exercises have no feedback', () => {
        const snapshot = getProgramCompletionSnapshot({
            status: 'active',
            weeks: [week(workout(exercise(), exercise('2026-09-01')))],
        })

        expect(snapshot.completedWorkouts).toBe(0)
        expect(snapshot.lastCompletedWorkoutAt).toBeNull()
    })

    it('counts a workout whose exercises all have feedback', () => {
        const snapshot = getProgramCompletionSnapshot({
            status: 'active',
            weeks: [week(workout(exercise('2026-09-01'), exercise('2026-09-02')))],
        })

        expect(snapshot.totalWorkouts).toBe(1)
        expect(snapshot.completedWorkouts).toBe(1)
        expect(snapshot.lastCompletedWorkoutAt).toEqual(new Date('2026-09-02'))
    })

    it('takes the latest feedback of an exercise, whatever the order', () => {
        const snapshot = getProgramCompletionSnapshot({
            status: 'active',
            weeks: [week(workout(exercise('2026-09-05', '2026-09-01')))],
        })

        expect(snapshot.lastCompletedWorkoutAt).toEqual(new Date('2026-09-05'))
    })

    it('keeps the most recent completion date across weeks', () => {
        const snapshot = getProgramCompletionSnapshot({
            status: 'active',
            weeks: [
                week(workout(exercise('2026-09-10'))),
                week(workout(exercise('2026-09-03'))),
            ],
        })

        expect(snapshot.completedWorkouts).toBe(2)
        expect(snapshot.lastCompletedWorkoutAt).toEqual(new Date('2026-09-10'))
    })

    it('does not let a later incomplete workout reset the last completion date', () => {
        const snapshot = getProgramCompletionSnapshot({
            status: 'active',
            weeks: [week(workout(exercise('2026-09-10')), workout(exercise()))],
        })

        expect(snapshot.totalWorkouts).toBe(2)
        expect(snapshot.completedWorkouts).toBe(1)
        expect(snapshot.lastCompletedWorkoutAt).toEqual(new Date('2026-09-10'))
    })
})

describe('getEffectiveProgramStatus', () => {
    it('returns the stored status for a draft program', () => {
        expect(getEffectiveProgramStatus({ status: 'draft' })).toBe('draft')
    })

    it('returns the stored status when no snapshot is given', () => {
        expect(getEffectiveProgramStatus({ status: 'active' })).toBe('active')
    })

    it('returns completed when every workout is done', () => {
        const status = getEffectiveProgramStatus(
            { status: 'active' },
            { totalWorkouts: 4, completedWorkouts: 4, lastCompletedWorkoutAt: new Date('2026-09-10') }
        )

        expect(status).toBe('completed')
    })

    it('stays active when a workout is still open', () => {
        const status = getEffectiveProgramStatus(
            { status: 'active' },
            { totalWorkouts: 4, completedWorkouts: 3, lastCompletedWorkoutAt: null }
        )

        expect(status).toBe('active')
    })

    it('stays active for an empty program even with a snapshot', () => {
        const status = getEffectiveProgramStatus(
            { status: 'active' },
            { totalWorkouts: 0, completedWorkouts: 0, lastCompletedWorkoutAt: null }
        )

        expect(status).toBe('active')
    })

    it('does not downgrade an already completed program', () => {
        const status = getEffectiveProgramStatus(
            { status: 'completed' },
            { totalWorkouts: 4, completedWorkouts: 1, lastCompletedWorkoutAt: null }
        )

        expect(status).toBe('completed')
    })

    it('does not promote a draft program even when every workout is done', () => {
        const status = getEffectiveProgramStatus(
            { status: 'draft' },
            { totalWorkouts: 2, completedWorkouts: 2, lastCompletedWorkoutAt: new Date('2026-09-10') }
        )

        expect(status).toBe('draft')
    })
})

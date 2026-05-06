import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkoutRecapPanel from '@/components/WorkoutRecapPanel'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (key === 'workouts.recapTitle') return 'Workout Recap'
            if (key === 'workouts.recapClose') return 'Close'
            if (key === 'workouts.recapLoading') return 'Loading recap...'
            if (key === 'workouts.recapError') return 'Recap error'
            if (key === 'workouts.recapSets') {
                return `${opts?.completed}/${opts?.target}`
            }
            if (key === 'workouts.recapSetLabel') {
                return `Set ${opts?.set}`
            }
            if (key === 'workouts.recapRepsUnit') return 'rep'
            if (key === 'workouts.recapWorkoutNote') return 'Workout note'
            return key
        },
    }),
}))

const mockRecapResponse = {
    data: {
        exercises: [
            {
                id: 'we-1',
                exerciseName: 'Back Squat',
                targetSets: 3,
                reps: '5',
                effectiveWeight: 120,
                completedSets: 2,
                status: 'in_progress',
                actualRpe: 8,
                exerciseNote: 'Solid session',
                sets: [
                    { setNumber: 1, reps: 5, weight: 120, completed: true },
                    { setNumber: 2, reps: 5, weight: 120, completed: true },
                    { setNumber: 3, reps: 0, weight: 0, completed: false },
                ],
            },
        ],
        workoutNote: 'Keep rest strict',
    },
}

describe('WorkoutRecapPanel', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('renders collapsed by default', () => {
        render(
            <WorkoutRecapPanel
                workoutId="w1"
            />
        )

        expect(screen.getByRole('button', { name: 'Workout Recap' })).toBeInTheDocument()
        expect(screen.queryByText('Back Squat')).not.toBeInTheDocument()
    })

    it('fetches recap data when panel is expanded the first time', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockRecapResponse,
        }) as unknown as typeof fetch

        const user = userEvent.setup()

        render(
            <WorkoutRecapPanel
                workoutId="w1"
            />
        )

        await user.click(screen.getByRole('button', { name: 'Workout Recap' }))
        await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
        expect(global.fetch).toHaveBeenCalled()
        expect(screen.getByText('3 × 5 × 120 kg')).toBeInTheDocument()
        expect(screen.getByText('2/3')).toBeInTheDocument()
        expect(screen.queryByText('Set 1')).not.toBeInTheDocument()
        expect(screen.queryByText('Workout note')).not.toBeInTheDocument()
    })

    it('re-fetches on second expand for same workout', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockRecapResponse,
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        render(
            <WorkoutRecapPanel
                workoutId="w-cache"
            />
        )

        const toggle = screen.getByRole('button', { name: 'Workout Recap' })

        await user.click(toggle)
        await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
        const callsAfterFirstOpen = vi.mocked(global.fetch).mock.calls.length
        expect(callsAfterFirstOpen).toBeGreaterThan(0)

        await user.click(toggle)
        expect(screen.queryByText('Back Squat')).not.toBeInTheDocument()

        await user.click(toggle)

        await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
        await waitFor(() => expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(callsAfterFirstOpen))
    })

    it('fetches again when workoutId changes', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockRecapResponse,
        }) as unknown as typeof fetch

        const { rerender } = render(
            <WorkoutRecapPanel
                workoutId="w1"
            />
        )

        const user = userEvent.setup()

        await user.click(screen.getByRole('button', { name: 'Workout Recap' }))

        await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())
        const callsAfterFirstWorkout = vi.mocked(global.fetch).mock.calls.length
        expect(callsAfterFirstWorkout).toBeGreaterThan(0)

        rerender(
            <WorkoutRecapPanel
                workoutId="w2"
            />
        )

        await user.click(screen.getByRole('button', { name: 'Workout Recap' }))

        await waitFor(() => expect(vi.mocked(global.fetch).mock.calls.length).toBeGreaterThan(callsAfterFirstWorkout))
    })

    it('closes when closeSignal changes', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockRecapResponse,
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        const { rerender } = render(
            <WorkoutRecapPanel
                workoutId="w1"
                closeSignal={0}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Workout Recap' }))
        await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())

        rerender(
            <WorkoutRecapPanel
                workoutId="w1"
                closeSignal={1}
            />
        )

        await waitFor(() => expect(screen.queryByText('Back Squat')).not.toBeInTheDocument())
    })

    it('closes when user selects an exercise', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockRecapResponse,
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        const onSelectExercise = vi.fn()

        render(
            <WorkoutRecapPanel
                workoutId="w1"
                onSelectExercise={onSelectExercise}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Workout Recap' }))
        await waitFor(() => expect(screen.getByText('Back Squat')).toBeInTheDocument())

        await user.click(screen.getByRole('button', { name: /Back Squat/i }))

        expect(onSelectExercise).toHaveBeenCalledWith('we-1')
        await waitFor(() => expect(screen.queryByText('Back Squat')).not.toBeInTheDocument())
    })
})

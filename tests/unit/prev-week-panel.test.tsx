import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrevWeekPanel, { __resetPrevWeekCacheForTests } from '@/components/PrevWeekPanel'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            if (key === 'workouts.prevWeekTitle') return 'Last Week'
            if (key === 'workouts.prevWeekClose') return 'Close'
            if (key === 'workouts.prevWeekLoading') return 'Loading...'
            if (key === 'workouts.prevWeekError') return 'Error'
            if (key === 'workouts.prevWeekNoData') return 'No data'
            if (key === 'workouts.prevWeekSetRow') {
                return `#${opts?.set} · ${opts?.reps} rep · ${opts?.weight} kg`
            }
            return key
        },
    }),
}))

const mockExercises = [
    {
        id: 'we-1',
        exerciseName: 'Bench Press',
        order: 1,
        targetSets: 3,
        targetReps: '8',
        exerciseNote: 'Felt strong',
        sets: [
            { setNumber: 1, reps: 8, weight: 80, completed: true },
            { setNumber: 2, reps: 8, weight: 80, completed: true },
            { setNumber: 3, reps: 7, weight: 80, completed: true },
        ],
    },
    {
        id: 'we-2',
        exerciseName: 'Tricep Extension',
        order: 2,
        targetSets: 3,
        targetReps: '12',
        exerciseNote: null,
        sets: [],
    },
]

describe('PrevWeekPanel', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        __resetPrevWeekCacheForTests()
    })

    it('renders header while collapsed by default', () => {
        render(<PrevWeekPanel workoutId="w1" />)

        expect(screen.getByText('Last Week')).toBeInTheDocument()
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    it('shows loading state after opening panel', async () => {
        global.fetch = vi.fn().mockImplementation(
            async () =>
                new Promise(() => {
                    // keep pending to assert initial loading state without late state updates
                })
        ) as unknown as typeof fetch

        const user = userEvent.setup()
        render(<PrevWeekPanel workoutId="w1" />)

        await user.click(screen.getByRole('button', { name: 'Last Week' }))

        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('displays exercises and sets after successful fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: mockExercises } }),
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        render(<PrevWeekPanel workoutId="w1" />)
        await user.click(screen.getByRole('button', { name: 'Last Week' }))

        await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument())
        expect(screen.getByText('#1 · 8 rep · 80 kg')).toBeInTheDocument()
        expect(screen.getByText('#3 · 7 rep · 80 kg')).toBeInTheDocument()
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        expect(screen.getByText('Felt strong')).toBeInTheDocument()
        expect(screen.getByText('3 x 12')).toBeInTheDocument()
    })

    it('shows error when fetch fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: 'Server error' } }),
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        render(<PrevWeekPanel workoutId="w1" />)
        await user.click(screen.getByRole('button', { name: 'Last Week' }))

        await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument())
    })

    it('toggles content visibility when header button is clicked', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: [] } }),
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        render(<PrevWeekPanel workoutId="w1" />)

        const toggle = screen.getByRole('button', { name: 'Last Week' })

        await user.click(toggle)
        await waitFor(() => expect(screen.getByText('No data')).toBeInTheDocument())

        await user.click(toggle)
        expect(screen.queryByText('No data')).not.toBeInTheDocument()
    })

    it('re-fetches when workoutId changes', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: [] } }),
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        const { rerender } = render(<PrevWeekPanel workoutId="w1" />)

        await user.click(screen.getByRole('button', { name: 'Last Week' }))

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

        rerender(<PrevWeekPanel workoutId="w2" />)

        await user.click(screen.getByRole('button', { name: 'Last Week' }))

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    })

    it('uses cache for same workout after remount', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: mockExercises } }),
        }) as unknown as typeof fetch

        const user = userEvent.setup()
        const firstRender = render(<PrevWeekPanel workoutId="w-cache" />)

        await user.click(screen.getByRole('button', { name: 'Last Week' }))
        await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument())
        expect(global.fetch).toHaveBeenCalledTimes(1)

        firstRender.unmount()

        render(<PrevWeekPanel workoutId="w-cache" />)
        await user.click(screen.getByRole('button', { name: 'Last Week' }))

        await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument())
        expect(global.fetch).toHaveBeenCalledTimes(1)
    })
})

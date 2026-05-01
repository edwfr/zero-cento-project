import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrevWeekPanel from '@/components/PrevWeekPanel'

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
        sets: [],
    },
]

describe('PrevWeekPanel', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    it('renders nothing when closed', () => {
        const { container } = render(
            <PrevWeekPanel workoutId="w1" isOpen={false} onClose={vi.fn()} />
        )

        expect(container).toBeEmptyDOMElement()
    })

    it('shows loading state initially when open', () => {
        global.fetch = vi.fn().mockImplementation(
            async () =>
                new Promise(() => {
                    // keep pending to assert initial loading state without late state updates
                })
        ) as unknown as typeof fetch

        render(<PrevWeekPanel workoutId="w1" isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('displays exercises and sets after successful fetch', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: mockExercises } }),
        }) as unknown as typeof fetch

        render(<PrevWeekPanel workoutId="w1" isOpen={true} onClose={vi.fn()} />)

        await waitFor(() => expect(screen.getByText('Bench Press')).toBeInTheDocument())
        expect(screen.getByText('#1 · 8 rep · 80 kg')).toBeInTheDocument()
        expect(screen.getByText('#3 · 7 rep · 80 kg')).toBeInTheDocument()
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        expect(screen.getByText('No data')).toBeInTheDocument()
    })

    it('shows error when fetch fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: 'Server error' } }),
        }) as unknown as typeof fetch

        render(<PrevWeekPanel workoutId="w1" isOpen={true} onClose={vi.fn()} />)

        await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument())
    })

    it('calls onClose when close button is clicked', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: [] } }),
        }) as unknown as typeof fetch

        const onClose = vi.fn()
        const user = userEvent.setup()
        render(<PrevWeekPanel workoutId="w1" isOpen={true} onClose={onClose} />)

        await user.click(screen.getByRole('button', { name: 'Close' }))
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('re-fetches when workoutId changes', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { exercises: [] } }),
        }) as unknown as typeof fetch

        const { rerender } = render(
            <PrevWeekPanel workoutId="w1" isOpen={true} onClose={vi.fn()} />
        )

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

        rerender(<PrevWeekPanel workoutId="w2" isOpen={true} onClose={vi.fn()} />)

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    })
})

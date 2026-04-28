import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useParams: () => ({ id: 'workout-1' }),
    useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@/lib/useSwipe', () => ({
    useSwipe: () => ({ handlers: {} }),
}))

const fixtureWorkout = {
    id: 'workout-1',
    dayIndex: 3,
    notes: null,
    weekNumber: 2,
    weekType: 'normal' as const,
    program: { id: 'p1', title: 'Test Program' },
    exercises: [
        {
            id: 'ex-1',
            name: 'Bench Press',
            variant: 'Wide grip',
            type: 'fundamental' as const,
            order: 1,
            weight: 80,
            weightType: 'absolute' as const,
            reps: '8',
            restSeconds: 120,
            targetRpe: 8,
            notes: null,
            feedback: {
                sets: [
                    { setIndex: 0, reps: 0, weight: 0, completed: false },
                    { setIndex: 1, reps: 0, weight: 0, completed: false },
                    { setIndex: 2, reps: 0, weight: 0, completed: false },
                    { setIndex: 3, reps: 0, weight: 0, completed: false },
                ],
                rpe: null,
            },
            effectiveWeight: 80,
        },
        {
            id: 'ex-2',
            name: 'Tricep Extension',
            variant: null,
            type: 'accessory' as const,
            order: 2,
            weight: 30,
            weightType: 'absolute' as const,
            reps: '12',
            restSeconds: 60,
            targetRpe: 7,
            notes: null,
            feedback: {
                sets: [
                    { setIndex: 0, reps: 0, weight: 0, completed: false },
                    { setIndex: 1, reps: 0, weight: 0, completed: false },
                    { setIndex: 2, reps: 0, weight: 0, completed: false },
                ],
                rpe: null,
            },
            effectiveWeight: null,
        },
    ],
}

beforeEach(() => {
    global.fetch = vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/trainee/workouts/')) {
            return {
                ok: true,
                json: async () => ({
                    data: { workout: fixtureWorkout },
                }),
            } as Response
        }
        return { ok: true, json: async () => ({}) } as Response
    }) as unknown as typeof fetch
    localStorage.clear()
})

const renderContent = async () => {
    const { default: WorkoutDetailContent } = await import(
        '@/app/trainee/workouts/[id]/_content'
    )
    const utils = render(<WorkoutDetailContent />)
    // Wait for fetch to resolve and render the first exercise
    await screen.findByText('Bench Press')
    return utils
}

describe('Trainee workout focus mode', () => {
    it('shows only the current exercise card', async () => {
        await renderContent()
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
        expect(screen.queryByText('Tricep Extension')).not.toBeInTheDocument()
    })

    it('advances to the next exercise via the bottom-nav Next button', async () => {
        const user = userEvent.setup()
        await renderContent()
        const nextBtn = screen.getByRole('button', { name: /next|avanti/i })
        await user.click(nextBtn)
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
    })

    it('returns to the previous exercise via the bottom-nav Back button', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /back|indietro/i }))
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
    })

    it('reaches the final summary step after the last exercise', async () => {
        const user = userEvent.setup()
        await renderContent()
        // step 0 -> 1 (Tricep Extension)
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        // step 1 -> 2 (final)
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        expect(screen.getByText(/summary|riepilogo/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /complete workout|completa allenamento/i })).toBeInTheDocument()
    })

    it('tapping the set-complete button on a set with empty inputs records the planned reps and effective weight', async () => {
        const user = userEvent.setup()
        await renderContent()
        const checkButtons = screen.getAllByRole('button', { name: /mark set/i })
        expect(checkButtons.length).toBeGreaterThanOrEqual(3)
        await user.click(checkButtons[0])

        const repsInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
        // First reps input (set #1, col reps) — should now hold planned 8
        expect(repsInputs[0].value).toBe('8')
        // First kg input (set #1, col kg) — should now hold planned effectiveWeight 80
        expect(repsInputs[1].value).toBe('80')
    })

    it('keeps inputs editable after a set is marked completed', async () => {
        const user = userEvent.setup()
        await renderContent()
        const checkButtons = screen.getAllByRole('button', { name: /mark set/i })
        await user.click(checkButtons[0])
        const repsInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
        expect(repsInput).not.toBeDisabled()
        await user.clear(repsInput)
        await user.type(repsInput, '7')
        expect(repsInput.value).toBe('7')
    })

    it('shows missing-data warning inline on the final step when no sets are completed', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        // On final step. No sets done in either exercise.
        expect(screen.getByText(/exercises with no data|esercizi senza dati/i)).toBeInTheDocument()
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
    })
})

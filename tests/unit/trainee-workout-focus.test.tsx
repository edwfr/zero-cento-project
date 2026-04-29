import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const routerPush = vi.fn()
let searchParamsValue = ''

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, replace: vi.fn() }),
    useParams: () => ({ id: 'workout-1' }),
    useSearchParams: () => new URLSearchParams(searchParamsValue),
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
            exercise: {
                id: 'exercise-1',
                name: 'Bench Press',
                description: null,
                type: 'fundamental' as const,
                youtubeUrl: null,
                notes: null,
            },
            variant: 'Wide grip',
            sets: 4,
            reps: '8',
            targetRpe: 8,
            weightType: 'absolute' as const,
            weight: 80,
            effectiveWeight: 80,
            restTime: 'm2' as const,
            isWarmup: false,
            isCompleted: false,
            notes: null,
            order: 1,
            feedback: null,
        },
        {
            id: 'ex-2',
            exercise: {
                id: 'exercise-2',
                name: 'Tricep Extension',
                description: null,
                type: 'accessory' as const,
                youtubeUrl: null,
                notes: null,
            },
            variant: null,
            sets: 3,
            reps: '12',
            targetRpe: 7,
            weightType: 'absolute' as const,
            weight: 30,
            effectiveWeight: null,
            restTime: 'm1' as const,
            isWarmup: false,
            isCompleted: false,
            notes: null,
            order: 2,
            feedback: null,
        },
    ],
}

beforeEach(() => {
    routerPush.mockReset()
    searchParamsValue = ''
    global.fetch = vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/trainee/workouts/')) {
            return {
                ok: true,
                json: async () => ({
                    data: { workout: fixtureWorkout },
                }),
            } as Response
        }

        if (typeof url === 'string' && url.includes('/api/trainee/workout-exercises/')) {
            return {
                ok: true,
                json: async () => ({
                    data: {
                        feedback: {
                            id: 'feedback-1',
                            workoutExerciseId: 'ex-1',
                            actualRpe: 8,
                            date: '2026-04-29T00:00:00.000Z',
                            updatedAt: '2026-04-29T12:00:00.000Z',
                            setsPerformed: [{ setNumber: 1, completed: true, reps: 8, weight: 80 }],
                        },
                        cascade: {
                            workoutExercise: { id: 'ex-1', isCompleted: false },
                            workout: { id: 'workout-1', isCompleted: false },
                            week: { id: 'week-1', isCompleted: false, weekNumber: 2 },
                            program: { id: 'program-1', status: 'active' },
                        },
                    },
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
        await user.click(screen.getByRole('button', { name: /prev|back|indietro/i }))
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
    })

    it('reaches the final summary step after the last exercise', async () => {
        const user = userEvent.setup()
        await renderContent()
        // step 0 -> 1 (Tricep Extension)
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        // step 1 -> 2 (final)
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        expect(screen.getAllByText(/summary|riepilogo/i).length).toBeGreaterThan(0)
        expect(screen.getByRole('button', { name: /completeShort|complete workout|completa allenamento/i })).toBeInTheDocument()
    })

    it('tapping the set-complete button on a set with empty inputs records the planned reps and effective weight', async () => {
        const user = userEvent.setup()
        await renderContent()
        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
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
        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])
        const repsInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
        expect(repsInput).not.toBeDisabled()
        await user.clear(repsInput)
        await user.type(repsInput, '7')
        expect(repsInput.value).toBe('7')
    })

    it('autosaves the exercise immediately when a set is marked completed', async () => {
        const user = userEvent.setup()
        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/trainee/workout-exercises/ex-1/feedback',
                expect.objectContaining({
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                })
            )
        })
    })

    it('shows missing-data warning inline on the final step when no sets are completed', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        // On final step. No sets done in either exercise.
        expect(screen.getAllByText(/missingDataInline|exercises with no data|esercizi senza dati/i)).toHaveLength(2)
        expect(screen.getByRole('button', { name: /Bench Press/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Tricep Extension/i })).toBeInTheDocument()
    })

    it('returns to the selected exercise when a missing-data warning is clicked', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))

        await user.click(screen.getByRole('button', { name: /Tricep Extension/i }))

        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /completeShort|complete workout|completa allenamento/i })).not.toBeInTheDocument()
    })

    it('shows an incomplete-sets warning inline on the final step when an exercise has unchecked sets', async () => {
        const user = userEvent.setup()
        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])

        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))

        expect(screen.getByText(/incompleteSetsInline|Exercises with incomplete sets|serie non completate/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Bench Press/i })).toBeInTheDocument()
    })

    it('returns to the selected exercise when an incomplete-sets warning is clicked', async () => {
        const user = userEvent.setup()
        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])

        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        await user.click(screen.getByRole('button', { name: /Bench Press/i }))

        expect(screen.getByText('Bench Press')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /completeShort|complete workout|completa allenamento/i })).not.toBeInTheDocument()
    })

    it('redirects back to the same current program after submit when programId is present', async () => {
        const user = userEvent.setup()
        searchParamsValue = 'from=current&programId=program-1'

        await renderContent()
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        await user.click(screen.getByRole('button', { name: /next|avanti/i }))
        await user.click(
            screen.getByRole('button', {
                name: /completeShort|complete workout|completa allenamento/i,
            })
        )

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/trainee/programs/current?programId=program-1')
        })
    })
})

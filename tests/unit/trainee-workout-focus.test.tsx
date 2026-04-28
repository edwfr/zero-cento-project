import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useParams: () => ({ id: 'workout-1' }),
    useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, vars?: Record<string, unknown>) => {
            if (vars) {
                let result = key
                Object.entries(vars).forEach(([k, v]) => {
                    result = result.replace(`{{${k}}}`, String(v))
                })
                return result
            }
            return key
        },
    }),
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
    it.todo('shows only the current exercise card')
    it.todo('advances to the next exercise via the bottom-nav Next button')
    it.todo('returns to the previous exercise via the bottom-nav Back button')
    it.todo('reaches the final summary step after the last exercise')
    it.todo('tapping the set-complete button on a set with empty inputs records the planned reps and effective weight')
    it.todo('keeps inputs editable after a set is marked completed')
    it.todo('shows missing-data warning inline on the final step when no sets are completed')
})

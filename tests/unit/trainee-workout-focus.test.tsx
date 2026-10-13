import { StrictMode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const routerPush = vi.fn()
// Shared spies: the toast and the translation args are part of the asserted behaviour.
const { showToast, tSpy } = vi.hoisted(() => ({
    showToast: vi.fn(),
    tSpy: vi.fn((key: string, _vars?: Record<string, unknown>) => key),
}))
let searchParamsValue = ''

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush, replace: vi.fn() }),
    useParams: () => ({ id: 'workout-1' }),
    useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
}))

// Same contract as the mock in setup.ts (t returns the key), with a spy on the args.
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: tSpy, i18n: { language: 'en', changeLanguage: vi.fn() } }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('@/lib/useSwipe', () => ({
    useSwipe: () => ({ handlers: {} }),
}))

// '@/components' loads all 53 components (MUI, recharts): ~48s under jsdom.
vi.mock('@/components', () => ({
    RPESelector: ({ value }: { value?: number }) => <div data-testid="rpe-selector">{value ?? ''}</div>,
    SkeletonDetail: () => <div data-testid="skeleton-detail" />,
    WeekTypeBanner: ({ weekType }: { weekType?: string }) => <div data-testid="week-type-banner">{weekType}</div>,
}))

import WorkoutDetailContent from '@/app/trainee/workouts/[id]/_content'

const fixtureWorkout = {
    id: 'workout-1',
    dayIndex: 3,
    notes: null,
    weekNumber: 2,
    weekType: 'volume' as const,
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
            isJumpSet: false,
            isSuperSet: false,
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
            isJumpSet: false,
            isSuperSet: false,
            isCompleted: false,
            notes: null,
            order: 2,
            feedback: null,
        },
    ],
}

beforeEach(() => {
    routerPush.mockReset()
    showToast.mockClear()
    tSpy.mockClear()
    searchParamsValue = ''
    global.Notification = Object.assign(vi.fn(), {
        permission: 'default' as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue('granted' as NotificationPermission),
    }) as unknown as typeof Notification

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
    const utils = render(<WorkoutDetailContent />)
    // Wait for fetch to resolve and render the first exercise
    await screen.findByText('Bench Press')
    return utils
}

// The bottom nav is the only <nav>; match the i18n key exactly, since the
// react-i18next mock in setup.ts returns the key itself.
const nextButton = () =>
    within(screen.getByRole('navigation')).getByRole('button', { name: 'workouts.next' })

describe('Trainee workout focus mode', () => {
    it('shows only the current exercise card', async () => {
        await renderContent()
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
        expect(screen.queryByText('Tricep Extension')).not.toBeInTheDocument()
    })

    it('advances to the next exercise via the bottom-nav Next button', async () => {
        const user = userEvent.setup()
        await renderContent()
        const nextBtn = nextButton()
        await user.click(nextBtn)
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        expect(screen.queryByText('Bench Press')).not.toBeInTheDocument()
    })

    it('returns to the previous exercise via the bottom-nav Back button', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(nextButton())
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: /^workouts\.prev$|\bback\b|indietro/i }))
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
    })

    it('reaches the final summary step after the last exercise', async () => {
        const user = userEvent.setup()
        await renderContent()
        // step 0 -> 1 (Tricep Extension)
        await user.click(nextButton())
        // step 1 -> 2 (final)
        await user.click(nextButton())
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

    it('shows full fundamental label in the rest row', async () => {
        await renderContent()

        expect(screen.getByText('Bench Press')).toBeInTheDocument()
        expect(screen.getByText('common:exerciseTypes.fundamental.label')).toBeInTheDocument()
        // Badge no longer uses abbreviated 'F'
        expect(screen.queryByText('F')).not.toBeInTheDocument()
    })

    it('shows full accessory label in the rest row', async () => {
        const user = userEvent.setup()
        await renderContent()

        await user.click(nextButton())

        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        expect(screen.getByText('common:exerciseTypes.accessory.label')).toBeInTheDocument()
        // Badge no longer uses abbreviated 'A'
        expect(screen.queryByText('A')).not.toBeInTheDocument()
    })

    it('renders flag icons in the badge row and opens trainer hint popovers on click', async () => {
        const user = userEvent.setup()

        const flaggedFixture = {
            ...fixtureWorkout,
            exercises: [
                {
                    ...fixtureWorkout.exercises[0],
                    isWarmup: false,
                    isJumpSet: false,
                    isSuperSet: false,
                },
                {
                    ...fixtureWorkout.exercises[1],
                    isWarmup: false,
                    isJumpSet: false,
                    isSuperSet: true,
                },
            ],
        }

        vi.mocked(global.fetch).mockImplementation((async (url: string) => {
            if (url.includes('/api/trainee/workouts/')) {
                return {
                    ok: true,
                    json: async () => ({ data: { workout: flaggedFixture } }),
                } as Response
            }
            return { ok: true, json: async () => ({}) } as Response
        }) as never)

        await renderContent()

        await user.click(nextButton())

        const superSetHintButton = screen.getByRole('button', {
            name: 'trainer:editProgram.superSetHint',
        })
        await user.click(superSetHintButton)
        expect(screen.getByText('trainer:editProgram.superSetHint')).toBeInTheDocument()
    })

    it('shows RPE target value in the targets row box', async () => {
        await renderContent()

        const rpeLabels = screen.getAllByText('RPE')
        const rpeBox = rpeLabels[0].closest('div[class*="rounded-xl"]')
        expect(rpeBox?.textContent).toContain('8')
    })

    it('does not render the fundamental/accessory type badge', async () => {
        await renderContent()

        expect(screen.queryByText('workouts.tagFundamental')).not.toBeInTheDocument()
        expect(screen.queryByText('workouts.tagAccessory')).not.toBeInTheDocument()
    })

    it('renders two RPE labels: target card and sets grid column', async () => {
        await renderContent()

        const rpeElements = screen.getAllByText('RPE')
        expect(rpeElements).toHaveLength(2)
    })

    it('uses resized set-grid proportions and compact numeric inputs', async () => {
        await renderContent()

        const repsHeader = screen.getByText('workouts.repsShort')
        const setsGrid = repsHeader.closest('div.grid')

        expect(setsGrid).toBeTruthy()
        expect(setsGrid?.className).toContain('grid-cols-[30px_3fr_5fr_3fr_42px]')
        expect(setsGrid?.className).toContain('gap-x-1')

        const spinInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
        expect(spinInputs[0].className).toContain('px-2')
        expect(spinInputs[0].className).toContain('tabular-nums')
        expect(spinInputs[1].className).toContain('px-2')
        expect(spinInputs[1].className).toContain('tabular-nums')
    })

    it('disables inputs after a set is marked completed', async () => {
        const user = userEvent.setup()
        await renderContent()
        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])
        const repsInput = screen.getAllByRole('spinbutton')[0] as HTMLInputElement
        expect(repsInput).toBeDisabled()
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

    it('uses keepalive: true on the set-autosave PATCH', async () => {
        const user = userEvent.setup()
        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])

        await waitFor(() => {
            const call = vi.mocked(global.fetch).mock.calls.find(
                ([url, init]) =>
                    typeof url === 'string'
                    && url.endsWith('/api/trainee/workout-exercises/ex-1/feedback')
                    && init?.method === 'PATCH'
            )

            expect(call).toBeTruthy()
            const init = call?.[1] as RequestInit
            expect(init.keepalive).toBe(true)

            const body = JSON.parse(init.body as string)
            expect(body).toHaveProperty('set')
            expect(body.set).toHaveProperty('actualRpe')
            expect(body.set.actualRpe).toBeNull()
        })
    })

    it('pads missing sets up to we.sets when feedback has fewer rows', async () => {
        const partialFixture = {
            ...fixtureWorkout,
            exercises: [
                {
                    ...fixtureWorkout.exercises[0],
                    feedback: {
                        id: 'feedback-1',
                        workoutExerciseId: 'ex-1',
                        traineeId: 'trainee-1',
                        date: '2026-05-11T00:00:00.000Z',
                        totalVolume: 0,
                        avgRPE: 8,
                        notes: null,
                        completed: false,
                        setsPerformed: [
                            { setNumber: 1, completed: true, reps: 8, weight: 80 },
                            { setNumber: 2, completed: true, reps: 8, weight: 80 },
                        ],
                    },
                },
                fixtureWorkout.exercises[1],
            ],
        }

        vi.mocked(global.fetch).mockImplementation((async (url: string) => {
            if (url.includes('/api/trainee/workouts/')) {
                return { ok: true, json: async () => ({ data: { workout: partialFixture } }) } as Response
            }
            return { ok: true, json: async () => ({}) } as Response
        }) as never)

        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        expect(checkButtons).toHaveLength(4)
    })

    it('preserves extra set rows beyond we.sets when present in feedback', async () => {
        const withExtraSetFixture = {
            ...fixtureWorkout,
            exercises: [
                {
                    ...fixtureWorkout.exercises[0],
                    feedback: {
                        id: 'feedback-1',
                        workoutExerciseId: 'ex-1',
                        traineeId: 'trainee-1',
                        date: '2026-05-11T00:00:00.000Z',
                        totalVolume: 0,
                        avgRPE: 8,
                        notes: null,
                        completed: false,
                        setsPerformed: [
                            { setNumber: 1, completed: true, reps: 8, weight: 80 },
                            { setNumber: 2, completed: true, reps: 8, weight: 80 },
                            { setNumber: 3, completed: true, reps: 8, weight: 80 },
                            { setNumber: 4, completed: true, reps: 8, weight: 80 },
                            { setNumber: 5, completed: false, reps: 0, weight: 0 },
                        ],
                    },
                },
                fixtureWorkout.exercises[1],
            ],
        }

        vi.mocked(global.fetch).mockImplementation((async (url: string) => {
            if (url.includes('/api/trainee/workouts/')) {
                return {
                    ok: true,
                    json: async () => ({ data: { workout: withExtraSetFixture } }),
                } as Response
            }
            return { ok: true, json: async () => ({}) } as Response
        }) as never)

        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        expect(checkButtons).toHaveLength(5)
    })

    it('prefers server data over stale localStorage feedback on mount', async () => {
        const storageKey = 'workout_workout-1_feedback'
        localStorage.setItem(
            storageKey,
            JSON.stringify({
                feedbackData: {
                    'ex-1': [{ setNumber: 1, completed: true, reps: 99, weight: 999 }],
                },
                exerciseRPE: { 'ex-1': 10 },
                exerciseNotes: { 'ex-1': 'stale note' },
                globalNotes: '',
                savedAt: new Date().toISOString(),
            })
        )

        await renderContent()

        const repsInputs = screen.getAllByRole('spinbutton') as HTMLInputElement[]
        expect(repsInputs[0].value).toBe('')
    })

    it('writes feedbackData to localStorage in the legacy shape for ProgramDetailContent', async () => {
        const user = userEvent.setup()
        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])

        await waitFor(() => {
            const raw = localStorage.getItem('workout_workout-1_feedback')
            expect(raw).toBeTruthy()

            const parsed = JSON.parse(raw as string)
            expect(parsed.feedbackData).toBeTruthy()
            expect(parsed.feedbackData['ex-1']).toBeTruthy()
            expect(parsed.feedbackData['ex-1'][0].completed).toBe(true)
        })
    })

    it('shows warning cards on the final step when no sets are completed', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(nextButton())
        await user.click(nextButton())
        // On final step. No sets done in either exercise.
        expect(screen.getByRole('button', { name: /Bench Press/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Tricep Extension/i })).toBeInTheDocument()
    })

    it('returns to the selected exercise when a missing-data warning is clicked', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(nextButton())
        await user.click(nextButton())

        await user.click(screen.getByRole('button', { name: /Tricep Extension/i }))

        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /completeShort|complete workout|completa allenamento/i })).not.toBeInTheDocument()
    })

    it('shows warning card on the final step when an exercise has unchecked sets', async () => {
        const user = userEvent.setup()
        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])

        await user.click(nextButton())
        await user.click(nextButton())

        expect(screen.getByRole('button', { name: /Bench Press/i })).toBeInTheDocument()
    })

    it('returns to the selected exercise when an incomplete-sets warning is clicked', async () => {
        const user = userEvent.setup()
        await renderContent()

        const checkButtons = screen.getAllByRole('button', { name: /workouts\.markSetDone/i })
        await user.click(checkButtons[0])

        await user.click(nextButton())
        await user.click(nextButton())
        await user.click(screen.getByRole('button', { name: /Bench Press/i }))

        expect(screen.getByText('Bench Press')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /completeShort|complete workout|completa allenamento/i })).not.toBeInTheDocument()
    })

    it('redirects back to the same current program after submit when programId is present', async () => {
        const user = userEvent.setup()
        searchParamsValue = 'from=current&programId=program-1'

        await renderContent()
        await user.click(nextButton())
        await user.click(nextButton())
        await user.click(
            screen.getByRole('button', {
                name: /completeShort|complete workout|completa allenamento/i,
            })
        )

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/trainee/programs/current?programId=program-1')
        })
    })

    it('shows prev-week button when weekNumber is greater than 1', async () => {
        await renderContent()

        expect(
            screen.getByRole('button', {
                name: /workouts\.prevWeekTitle|settimana precedente|last week/i,
            })
        ).toBeInTheDocument()
    })

    it('hides prev-week button when weekNumber is 1', async () => {
        global.fetch = vi.fn(async (url: string) => {
            if (typeof url === 'string' && url.includes('/api/trainee/workouts/')) {
                return {
                    ok: true,
                    json: async () => ({
                        data: { workout: { ...fixtureWorkout, weekNumber: 1 } },
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
                                week: { id: 'week-1', isCompleted: false, weekNumber: 1 },
                                program: { id: 'program-1', status: 'active' },
                            },
                        },
                    }),
                } as Response
            }

            return { ok: true, json: async () => ({}) } as Response
        }) as unknown as typeof fetch

        await renderContent()

        const header = screen.getByTestId('focus-mode-header')

        expect(
            within(header).queryByRole('button', {
                name: /workouts\.prevWeekTitle|settimana precedente|last week/i,
            })
        ).not.toBeInTheDocument()
    })

    it('exercise note section is collapsed by default when no saved note', async () => {
        await renderContent()

        expect(
            screen.queryByPlaceholderText(/workouts\.exerciseNotePlaceholder/i)
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /workouts\.exerciseNoteLabel/i })
        ).toBeInTheDocument()
    })

    it('exercise note section expands when header button is clicked', async () => {
        const user = userEvent.setup()
        await renderContent()

        const toggleBtn = screen.getByRole('button', { name: /workouts\.exerciseNoteLabel/i })
        await user.click(toggleBtn)

        expect(
            screen.getByPlaceholderText(/workouts\.exerciseNotePlaceholder/i)
        ).toBeInTheDocument()
    })

    it('exercise note section collapses again after a second click on the header', async () => {
        const user = userEvent.setup()
        await renderContent()

        const toggleBtn = screen.getByRole('button', { name: /workouts\.exerciseNoteLabel/i })
        await user.click(toggleBtn)
        await user.click(toggleBtn)

        expect(
            screen.queryByPlaceholderText(/workouts\.exerciseNotePlaceholder/i)
        ).not.toBeInTheDocument()
    })
})

describe('Trainee workout focus mode with warm-up exercises', () => {
    const warmupFixture = {
        ...fixtureWorkout,
        exercises: [
            {
                ...fixtureWorkout.exercises[0],
                id: 'ex-w',
                order: 0,
                isWarmup: true,
                exercise: { ...fixtureWorkout.exercises[0].exercise, id: 'exercise-w', name: 'Band Pull Apart' },
            },
            ...fixtureWorkout.exercises,
        ],
    }

    beforeEach(() => {
        vi.mocked(global.fetch).mockImplementation((async (url: string) => {
            if (url.includes('/api/trainee/workouts/')) {
                return { ok: true, json: async () => ({ data: { workout: warmupFixture } }) } as Response
            }
            return { ok: true, json: async () => ({}) } as Response
        }) as never)
    })

    it('does not render the warm-up exercise as a step card', async () => {
        await renderContent()
        expect(screen.getByRole('heading', { name: 'Bench Press' })).toBeInTheDocument()
        // the warm-up lives in the panel (as a row), never as a step card
        expect(screen.queryByRole('heading', { name: 'Band Pull Apart' })).not.toBeInTheDocument()
    })

    it('reaches the final step after two next clicks (warm-up is not a step)', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(nextButton())
        await user.click(nextButton())
        expect(screen.getByText('workouts.summaryTitle')).toBeInTheDocument()
    })

    it('counts only non-warm-up exercises in the step counter', async () => {
        const user = userEvent.setup()
        await renderContent()
        expect(tSpy).toHaveBeenCalledWith('workouts.stepCounter', { current: 1, total: 2 })

        await user.click(nextButton())
        expect(tSpy).toHaveBeenCalledWith('workouts.stepCounter', { current: 2, total: 2 })
        expect(tSpy).not.toHaveBeenCalledWith(
            'workouts.stepCounter',
            expect.objectContaining({ total: 3 })
        )
    })

    it('counts only non-warm-up exercises in the summary stats', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(nextButton())
        await user.click(nextButton())
        expect(tSpy).toHaveBeenCalledWith('workouts.summaryStats', { done: 0, total: 2, sets: 0 })
    })

    it('does not list the warm-up exercise among incomplete exercises on the final step', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(nextButton())
        await user.click(nextButton())
        const names = screen.getAllByRole('button').map((b) => b.textContent ?? '')
        expect(names.some((n) => n.includes('Bench Press'))).toBe(true)
        expect(names.some((n) => n.includes('Tricep Extension'))).toBe(true)
        expect(names.some((n) => n.includes('Band Pull Apart'))).toBe(false)
    })

    it('submits every exercise, warm-up included', async () => {
        const user = userEvent.setup()
        await renderContent()
        await user.click(nextButton())
        await user.click(nextButton())
        await user.click(
            screen.getByRole('button', { name: /completeShort|complete workout|completa allenamento/i })
        )

        await waitFor(() => {
            const call = vi
                .mocked(global.fetch)
                .mock.calls.find(([u]) => typeof u === 'string' && u.endsWith('/submit'))
            expect(call).toBeTruthy()
            const body = JSON.parse((call![1] as RequestInit).body as string)
            expect(body.exercises).toHaveLength(3)
            expect(body.exercises.map((e: { workoutExerciseId?: string; id?: string }) => e.workoutExerciseId ?? e.id)).toContain('ex-w')
        })
    })
})

describe('Trainee workout warm-up panel', () => {
    const warmupExercise = {
        ...fixtureWorkout.exercises[0],
        id: 'ex-w',
        order: 0,
        isWarmup: true,
        exercise: { ...fixtureWorkout.exercises[0].exercise, id: 'exercise-w', name: 'Band Pull Apart' },
    }
    const warmupFixture = { ...fixtureWorkout, exercises: [warmupExercise, ...fixtureWorkout.exercises] }

    const mockWorkout = (workout: unknown, allCompleted = false) => {
        vi.mocked(global.fetch).mockImplementation((async (url: string) => {
            if (url.includes('/api/trainee/workouts/')) {
                return { ok: true, json: async () => ({ data: { workout } }) } as Response
            }
            if (url.includes('/api/trainee/workout-exercises/')) {
                const workoutExerciseId = url.split('/workout-exercises/')[1].split('/')[0]
                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            feedback: { id: 'f', workoutExerciseId, actualRpe: null, setsPerformed: [] },
                            cascade: {
                                workoutExercise: { id: workoutExerciseId, isCompleted: allCompleted },
                                workout: { id: 'workout-1', isCompleted: allCompleted },
                                week: { id: 'week-1', isCompleted: allCompleted, weekNumber: 2 },
                                program: {
                                    id: 'program-1',
                                    status: allCompleted ? 'completed' : 'active',
                                },
                            },
                        },
                    }),
                } as Response
            }
            return { ok: true, json: async () => ({}) } as Response
        }) as never)
    }

    const panelHeader = () => within(screen.getByTestId('warmup-panel')).getAllByRole('button')[0]

    it('renders no panel when the workout has no warm-up', async () => {
        await renderContent()
        expect(screen.queryByTestId('warmup-panel')).not.toBeInTheDocument()
    })

    it('is expanded on step 0 and collapses on step change, reopenable', async () => {
        mockWorkout(warmupFixture)
        const user = userEvent.setup()
        await renderContent()

        expect(panelHeader()).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByText('Band Pull Apart')).toBeInTheDocument()

        await user.click(nextButton())
        expect(panelHeader()).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByText('Band Pull Apart')).not.toBeInTheDocument()

        await user.click(panelHeader())
        expect(panelHeader()).toHaveAttribute('aria-expanded', 'true')
    })

    it('stays rendered, collapsed, above the summary on the final step', async () => {
        mockWorkout(warmupFixture)
        const user = userEvent.setup()
        await renderContent()
        await user.click(nextButton())
        await user.click(nextButton())

        expect(screen.getByText('workouts.summaryTitle')).toBeInTheDocument()
        expect(panelHeader()).toHaveAttribute('aria-expanded', 'false')
    })

    it('renders the final step with the panel when every exercise is warm-up', async () => {
        mockWorkout({
            ...fixtureWorkout,
            exercises: fixtureWorkout.exercises.map((e) => ({ ...e, isWarmup: true })),
        })
        render(<WorkoutDetailContent />)
        await screen.findByTestId('warmup-panel')

        expect(screen.getByText('workouts.summaryTitle')).toBeInTheDocument()
        expect(panelHeader()).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
        expect(screen.getByText('Tricep Extension')).toBeInTheDocument()
    })

    it('persists a set logged from the panel with the standard feedback PATCH', async () => {
        mockWorkout(warmupFixture)
        const user = userEvent.setup()
        await renderContent()

        await user.click(screen.getByText('Band Pull Apart'))
        const markButtons = within(screen.getByTestId('warmup-panel')).getAllByRole('button', {
            name: /workouts\.markSetDone/i,
        })
        await user.click(markButtons[0])

        await waitFor(() => {
            const call = vi
                .mocked(global.fetch)
                .mock.calls.find(
                    ([u, init]) =>
                        typeof u === 'string' &&
                        u.includes('/api/trainee/workout-exercises/ex-w/feedback') &&
                        (init as RequestInit)?.method === 'PATCH'
                )
            expect(call).toBeTruthy()
            const body = JSON.parse((call![1] as RequestInit).body as string)
            expect(body.set.completed).toBe(true)
            expect(body.set.reps).toBe(8)
            expect(body.set.weight).toBe(80)
        })
    })

    const completionToasts = () =>
        showToast.mock.calls.filter(([message]) =>
            /workouts\.(workout|week|program)CompletedToast/.test(String(message))
        )

    const feedbackPatchFor = (workoutExerciseId: string) =>
        vi
            .mocked(global.fetch)
            .mock.calls.find(
                ([u, init]) =>
                    typeof u === 'string' &&
                    u.includes(`/api/trainee/workout-exercises/${workoutExerciseId}/feedback`) &&
                    (init as RequestInit)?.method === 'PATCH'
            )

    it('shows the completion toasts when a main exercise completes the workout', async () => {
        mockWorkout(warmupFixture, true)
        const user = userEvent.setup()
        await renderContent()

        const markButtons = screen
            .getAllByRole('button', { name: /workouts\.markSetDone/i })
            .filter((b) => !screen.getByTestId('warmup-panel').contains(b))
        await user.click(markButtons[0])

        await waitFor(() => expect(completionToasts()).toHaveLength(3))
    })

    it('never shows a completion toast when a warm-up exercise is completed', async () => {
        mockWorkout(warmupFixture, true)
        const user = userEvent.setup()
        await renderContent()

        await user.click(screen.getByText('Band Pull Apart'))
        const markButtons = within(screen.getByTestId('warmup-panel')).getAllByRole('button', {
            name: /workouts\.markSetDone/i,
        })
        await user.click(markButtons[0])

        await waitFor(() => expect(feedbackPatchFor('ex-w')).toBeTruthy())
        // completion toasts are scheduled up to 400ms after the response
        await new Promise((resolve) => setTimeout(resolve, 600))
        expect(completionToasts()).toHaveLength(0)
    })

    it('is expanded on landing under React StrictMode', async () => {
        mockWorkout(warmupFixture)
        render(
            <StrictMode>
                <WorkoutDetailContent />
            </StrictMode>
        )
        await screen.findByTestId('warmup-panel')

        expect(panelHeader()).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByText('Band Pull Apart')).toBeInTheDocument()
    })

    it('starts collapsed when every warm-up exercise is already completed', async () => {
        mockWorkout({
            ...warmupFixture,
            exercises: [{ ...warmupExercise, isCompleted: true }, ...fixtureWorkout.exercises],
        })
        await renderContent()
        expect(panelHeader()).toHaveAttribute('aria-expanded', 'false')
    })

    it('never uses amber styling inside the panel', async () => {
        mockWorkout(warmupFixture)
        await renderContent()
        const panel = screen.getByTestId('warmup-panel')
        expect(panel.querySelector('[class*="amber"]')).toBeNull()
    })
})

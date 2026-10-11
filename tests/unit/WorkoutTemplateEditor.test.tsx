import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WorkoutTemplateEditor from '@/components/WorkoutTemplateEditor'

const routerPush = vi.fn()
const loaderStart = vi.fn()
const loaderStop = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush }),
}))

vi.mock('@/components/NavigationLoadingProvider', () => ({
    useNavigationLoader: () => ({ start: loaderStart, stop: loaderStop }),
}))

vi.mock('@/lib/i18n/client', () => ({}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) =>
            opts?.n !== undefined ? `${key}:${opts.n}` : key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('@/components/AutocompleteSearch', () => ({
    default: ({ onSelect, id }: { onSelect: (o: { id: string; label: string } | null) => void; id?: string }) => (
        <button type="button" data-testid={id} onClick={() => onSelect({ id: EXERCISE_ID, label: 'Squat' })}>
            pick
        </button>
    ),
}))

const EXERCISE_ID = '00000000-0000-4000-8000-000000000001'

function mockFetch(saveResponse: { ok: boolean; json: unknown } = { ok: true, json: { data: {} } }) {
    const fn = vi.fn(async (url: string) => {
        if (String(url).startsWith('/api/exercises')) {
            return { ok: true, json: async () => ({ data: { items: [{ id: EXERCISE_ID, name: 'Squat' }] } }) }
        }
        return { ok: saveResponse.ok, json: async () => saveResponse.json }
    })
    global.fetch = fn as unknown as typeof fetch
    return fn
}

const saveCalls = (fn: ReturnType<typeof mockFetch>) =>
    fn.mock.calls.filter(([url]) => !String(url).startsWith('/api/exercises'))

function fillRow() {
    fireEvent.click(screen.getAllByText('trainer:templates.addExercise')[0])
    fireEvent.click(screen.getByText('pick'))
    fireEvent.change(screen.getByLabelText('trainer:templates.colSets'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('trainer:templates.colReps'), { target: { value: '8-10' } })
    fireEvent.change(screen.getByLabelText('trainer:templates.colRest'), { target: { value: 'm2' } })
}

describe('WorkoutTemplateEditor', () => {
    beforeEach(() => {
        routerPush.mockReset()
        loaderStart.mockReset()
        loaderStop.mockReset()
    })

    it('renders 3 workout blocks by default', () => {
        mockFetch()
        render(<WorkoutTemplateEditor />)
        expect(screen.getByText('trainer:templates.workoutLabel:1')).toBeTruthy()
        expect(screen.getByText('trainer:templates.workoutLabel:3')).toBeTruthy()
        expect(screen.queryByText('trainer:templates.workoutLabel:4')).toBeNull()
    })

    it('adds and removes workout blocks when workouts per week changes', () => {
        mockFetch()
        render(<WorkoutTemplateEditor />)
        const input = screen.getByLabelText('trainer:templates.workoutsPerWeekLabel')
        fireEvent.change(input, { target: { value: '2' } })
        fireEvent.blur(input)
        expect(screen.queryByText('trainer:templates.workoutLabel:3')).toBeNull()
        fireEvent.change(input, { target: { value: '4' } })
        fireEvent.blur(input)
        expect(screen.getByText('trainer:templates.workoutLabel:4')).toBeTruthy()
    })

    it('keeps all workout blocks while the field is empty mid-typing and resizes on blur', () => {
        mockFetch()
        render(<WorkoutTemplateEditor />)
        const input = screen.getByLabelText('trainer:templates.workoutsPerWeekLabel')
        fireEvent.change(input, { target: { value: '' } })
        expect(screen.getByText('trainer:templates.workoutLabel:3')).toBeTruthy()
        fireEvent.change(input, { target: { value: '5' } })
        fireEvent.blur(input)
        expect(screen.getByText('trainer:templates.workoutLabel:5')).toBeTruthy()
    })

    it('restores the previous value when the field is left empty', () => {
        mockFetch()
        render(<WorkoutTemplateEditor />)
        const input = screen.getByLabelText('trainer:templates.workoutsPerWeekLabel') as HTMLInputElement
        fireEvent.change(input, { target: { value: '' } })
        fireEvent.blur(input)
        expect(input.value).toBe('3')
        expect(screen.getByText('trainer:templates.workoutLabel:3')).toBeTruthy()
    })

    it('asks confirmation before dropping non-empty workouts and keeps them when declined', () => {
        mockFetch()
        const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
        render(<WorkoutTemplateEditor />)
        fireEvent.click(screen.getAllByText('trainer:templates.addExercise')[2])
        const input = screen.getByLabelText('trainer:templates.workoutsPerWeekLabel') as HTMLInputElement
        fireEvent.change(input, { target: { value: '2' } })
        fireEvent.blur(input)
        expect(confirm).toHaveBeenCalled()
        expect(input.value).toBe('3')
        expect(screen.getByText('pick')).toBeTruthy()
        confirm.mockRestore()
    })

    it('adds a row with the 4 inputs and removes it, with no weight/RPE fields', () => {
        mockFetch()
        const { container } = render(<WorkoutTemplateEditor />)
        fireEvent.click(screen.getAllByText('trainer:templates.addExercise')[0])
        expect(screen.getByText('pick')).toBeTruthy()
        expect(screen.getByLabelText('trainer:templates.colSets')).toBeTruthy()
        expect(screen.getByLabelText('trainer:templates.colReps')).toBeTruthy()
        expect(screen.getByLabelText('trainer:templates.colRest')).toBeTruthy()
        expect(container.querySelector('[name="weight"]')).toBeNull()
        expect(container.querySelector('[name="targetRpe"]')).toBeNull()
        fireEvent.click(screen.getByLabelText('trainer:templates.removeExercise'))
        expect(screen.queryByText('pick')).toBeNull()
    })

    it('does not call the API and shows an error when the name is empty', async () => {
        const fn = mockFetch()
        render(<WorkoutTemplateEditor />)
        fireEvent.click(screen.getByText('trainer:templates.saveToLibrary'))
        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
        expect(saveCalls(fn)).toHaveLength(0)
    })

    it('POSTs a valid template in create mode and navigates', async () => {
        const fn = mockFetch()
        render(<WorkoutTemplateEditor />)
        fireEvent.change(screen.getByLabelText('trainer:templates.nameLabel'), { target: { value: 'Week A' } })
        const perWeek = screen.getByLabelText('trainer:templates.workoutsPerWeekLabel')
        fireEvent.change(perWeek, { target: { value: '2' } })
        fireEvent.blur(perWeek)
        fillRow()
        fireEvent.click(screen.getByText('trainer:templates.saveToLibrary'))

        await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/trainer/templates'))
        const [url, init] = saveCalls(fn)[0] as unknown as [string, RequestInit]
        expect(url).toBe('/api/workout-templates')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body as string)).toEqual({
            name: 'Week A',
            workoutsPerWeek: 2,
            workouts: [
                { dayIndex: 0, exercises: [{ exerciseId: EXERCISE_ID, sets: 3, reps: '8-10', restTime: 'm2' }] },
                { dayIndex: 1, exercises: [] },
            ],
        })
        expect(loaderStart).toHaveBeenCalled()
    })

    it('pre-fills and PUTs in edit mode', async () => {
        const fn = mockFetch()
        render(
            <WorkoutTemplateEditor
                initialTemplate={{
                    id: 'tpl-1',
                    name: 'Existing',
                    workoutsPerWeek: 1,
                    workouts: [
                        { dayIndex: 0, exercises: [{ exerciseId: EXERCISE_ID, sets: 4, reps: '5', restTime: 'm3' }] },
                    ],
                }}
            />
        )
        expect((screen.getByLabelText('trainer:templates.nameLabel') as HTMLInputElement).value).toBe('Existing')
        expect((screen.getByLabelText('trainer:templates.colSets') as HTMLInputElement).value).toBe('4')
        fireEvent.click(screen.getByText('trainer:templates.saveToLibrary'))
        await waitFor(() => expect(routerPush).toHaveBeenCalled())
        const [url, init] = saveCalls(fn)[0] as unknown as [string, RequestInit]
        expect(url).toBe('/api/workout-templates/tpl-1')
        expect(init.method).toBe('PUT')
    })

    it('shows the API error, re-enables save and stops the loader', async () => {
        mockFetch({ ok: false, json: { error: { code: 'X', message: 'Server boom' } } })
        render(<WorkoutTemplateEditor />)
        fireEvent.change(screen.getByLabelText('trainer:templates.nameLabel'), { target: { value: 'Week A' } })
        const perWeek = screen.getByLabelText('trainer:templates.workoutsPerWeekLabel')
        fireEvent.change(perWeek, { target: { value: '1' } })
        fireEvent.blur(perWeek)
        fillRow()
        fireEvent.click(screen.getByText('trainer:templates.saveToLibrary'))

        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
        expect(routerPush).not.toHaveBeenCalled()
        expect(loaderStop).toHaveBeenCalled()
        const save = screen.getByText('trainer:templates.saveToLibrary').closest('button') as HTMLButtonElement
        expect(save.disabled).toBe(false)
    })
})

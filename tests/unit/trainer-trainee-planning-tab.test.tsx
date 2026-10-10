import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { MacroPeriodTimelineProps } from '@/components/MacroPeriodTimeline'

const mocks = vi.hoisted(() => ({
    timeline: null as MacroPeriodTimelineProps | null,
    showToast: vi.fn(),
    push: vi.fn(),
    startLoader: vi.fn(),
}))

// The real timeline is loaded with next/dynamic: replace the loader with a stub that records its props
vi.mock('next/dynamic', () => ({
    default: () => (props: MacroPeriodTimelineProps) => {
        mocks.timeline = props
        return <div data-testid="timeline" />
    },
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@/components/NavigationLoadingProvider', () => ({
    useNavigationLoader: () => ({ isLoading: false, start: mocks.startLoader, stop: vi.fn() }),
}))

import PlanningTab from '@/app/trainer/trainees/[id]/_planning-tab'
import {
    VIEW_SPAN_MS,
    WEEK_MS,
    dayToLocalMs,
    type MacroPeriodDto,
    type MacroPhaseTypeDto,
    type PlanProgramDto,
} from '@/lib/macro-periods'

const TRAINEE_ID = 'trainee-1'

const phase = (overrides: Partial<MacroPhaseTypeDto>): MacroPhaseTypeDto => ({
    id: 'ph1',
    name: 'Forza',
    description: 'Carichi alti',
    color: '#2563eb',
    sortOrder: 0,
    isActive: true,
    usageCount: 1,
    ...overrides,
})

const PHASES = [
    phase({ id: 'ph1', name: 'Forza' }),
    phase({ id: 'ph2', name: 'Scarico', description: null, sortOrder: 1, usageCount: 0 }),
    phase({ id: 'ph3', name: 'Vecchia usata', sortOrder: 2, isActive: false }),
    phase({ id: 'ph4', name: 'Vecchia mai usata', sortOrder: 3, isActive: false, usageCount: 0 }),
]

const period = (id: string, startDate: string, endDate: string, phaseId = 'ph1'): MacroPeriodDto => {
    const source = PHASES.find((item) => item.id === phaseId) ?? PHASES[0]
    return {
        id,
        startDate,
        endDate,
        note: null,
        phaseType: { id: source.id, name: source.name, color: source.color, isActive: source.isActive },
    }
}

const PERIODS = [period('a', '2026-10-05', '2026-10-18'), period('b', '2026-11-02', '2026-11-08', 'ph3')]
const PROGRAMS: PlanProgramDto[] = [{ id: 'g1', title: 'Scheda A', status: 'active', startDate: '2026-10-07', durationWeeks: 4 }]

type Call = { url: string; method: string; body: unknown }
type Reply = { status: number; json: unknown }

interface ApiOptions {
    periods?: MacroPeriodDto[]
    loadStatus?: number
    onWrite?: (call: Call) => Reply
}

function mockApi({ periods = PERIODS, loadStatus = 200, onWrite }: ApiOptions = {}) {
    const calls: Call[] = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        const reply = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json }) as Response

        if (method === 'GET') {
            if (url === '/api/macro-phase-types') return reply(loadStatus, { data: { items: PHASES } })
            return reply(loadStatus, { data: { periods, programs: PROGRAMS } })
        }

        const call = { url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined }
        calls.push(call)
        const { status, json } = onWrite ? onWrite(call) : { status: 200, json: { data: {} } }
        return reply(status, json)
    })
    return calls
}

function timeline(): MacroPeriodTimelineProps {
    if (!mocks.timeline) throw new Error('timeline not rendered')
    return mocks.timeline
}

async function renderTab(options?: ApiOptions) {
    const calls = mockApi(options)
    render(<PlanningTab traineeId={TRAINEE_ID} />)
    await screen.findByTestId('timeline')
    return calls
}

const TODAY = '2026-10-07' // a Wednesday

describe('PlanningTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.timeline = null
        // only the clock is faked, so waitFor and findBy* keep working
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(`${TODAY}T10:00:00.000Z`))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('loads the plan and hands periods and programs to the timeline', async () => {
        await renderTab()

        expect(global.fetch).toHaveBeenCalledWith(`/api/trainer/trainees/${TRAINEE_ID}/macro-periods`)
        expect(global.fetch).toHaveBeenCalledWith('/api/macro-phase-types')
        expect(timeline().periods).toEqual(PERIODS)
        expect(timeline().programs).toEqual(PROGRAMS)
        expect(timeline().view).toBe('weeks')
        expect(timeline().visibleEnd - timeline().visibleStart).toBe(VIEW_SPAN_MS.weeks)
        // two weeks of lead-in before the current week
        expect(timeline().visibleStart).toBe(dayToLocalMs('2026-10-05') - 2 * WEEK_MS)
    })

    it('lists in the legend the active phases and the archived ones still in use, with their meaning', async () => {
        await renderTab()

        const legend = within(screen.getByRole('list', { name: 'planning.legend' }))
        expect(legend.getByText('Forza')).toBeInTheDocument()
        // every fixture phase carries the same meaning text
        expect(legend.getAllByText('Carichi alti').length).toBeGreaterThan(0)
        expect(legend.getByText('Scarico')).toBeInTheDocument()
        expect(legend.getByText('Vecchia usata')).toBeInTheDocument()
        expect(legend.getByText('planning.archivedPhase')).toBeInTheDocument()
        expect(legend.queryByText('Vecchia mai usata')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'planning.managePhases' })).toHaveAttribute('href', '/profile')
    })

    it('shows the empty hint when nothing is planned', async () => {
        await renderTab({ periods: [] })

        expect(screen.getByText('planning.empty')).toBeInTheDocument()
    })

    it('shows an error with a retry when the plan cannot be loaded', async () => {
        mockApi({ loadStatus: 500 })
        render(<PlanningTab traineeId={TRAINEE_ID} />)

        expect(await screen.findByText('planning.loadError')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'common:common.retry' })).toBeInTheDocument()
        expect(screen.queryByTestId('timeline')).not.toBeInTheDocument()
    })

    it('opens the dialog on a drawn range and adds the saved period to the timeline', async () => {
        const created = period('c', '2026-10-19', '2026-10-25')
        const calls = await renderTab({ onWrite: () => ({ status: 201, json: { data: { period: created } } }) })

        act(() => {
            timeline().onDraftChange({ startDate: '2026-10-19', endDate: '2026-10-25' })
            timeline().onDraftCommit({ startDate: '2026-10-19', endDate: '2026-10-25' })
        })

        expect(timeline().draft).toEqual({ startDate: '2026-10-19', endDate: '2026-10-25' })
        const dialog = within(screen.getByRole('dialog'))
        expect(dialog.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-10-19')

        fireEvent.click(dialog.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(calls).toEqual([
            {
                url: `/api/trainer/trainees/${TRAINEE_ID}/macro-periods`,
                method: 'POST',
                body: { phaseTypeId: 'ph1', startDate: '2026-10-19', endDate: '2026-10-25', note: null },
            },
        ])
        expect(timeline().periods.map((item) => item.id)).toEqual(['a', 'c', 'b'])
        expect(timeline().draft).toBeNull()
    })

    it('keeps the dialog open with the message when the phase was archived elsewhere', async () => {
        await renderTab({
            onWrite: () => ({ status: 409, json: { error: { code: 'CONFLICT', message: 'x', key: 'macroPhase.archived' } } }),
        })

        act(() => timeline().onDraftCommit({ startDate: '2026-10-19', endDate: '2026-10-25' }))
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'common:common.save' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('errors:macroPhase.archived')
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(timeline().periods).toEqual(PERIODS)
    })

    it('refuses in the dialog a range that overlaps another period, without calling the API', async () => {
        const calls = await renderTab()

        act(() => timeline().onDraftCommit({ startDate: '2026-10-19', endDate: '2026-10-25' }))
        const dialog = within(screen.getByRole('dialog'))
        fireEvent.change(dialog.getByLabelText(/planning\.endWeek/), { target: { value: '2026-11-04' } })
        fireEvent.click(dialog.getByRole('button', { name: 'common:common.save' }))

        expect(await screen.findByRole('alert')).toHaveTextContent('errors:macroPeriod.overlap')
        expect(calls).toHaveLength(0)
    })

    it('discards the draft when the dialog is cancelled', async () => {
        await renderTab()

        act(() => {
            timeline().onDraftChange({ startDate: '2026-10-19', endDate: '2026-10-25' })
            timeline().onDraftCommit({ startDate: '2026-10-19', endDate: '2026-10-25' })
        })
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'common:common.cancel' }))

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(timeline().draft).toBeNull()
    })

    it('opens an empty dialog from the "new period" button', async () => {
        await renderTab()

        fireEvent.click(screen.getByRole('button', { name: 'planning.newPeriod' }))

        const dialog = within(screen.getByRole('dialog'))
        expect(dialog.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-10-05')
    })

    it('applies a drag at once and saves it', async () => {
        const calls = await renderTab({
            onWrite: () => ({ status: 200, json: { data: { period: period('a', '2026-10-19', '2026-11-01') } } }),
        })

        act(() => timeline().onPeriodChange('a', { startDate: '2026-10-19', endDate: '2026-11-01' }))

        // optimistic: visible before the request resolves
        expect(timeline().periods.find((item) => item.id === 'a')).toMatchObject({ startDate: '2026-10-19', endDate: '2026-11-01' })
        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({
            url: '/api/macro-periods/a',
            method: 'PATCH',
            body: { startDate: '2026-10-19', endDate: '2026-11-01' },
        })
        expect(mocks.showToast).not.toHaveBeenCalled()
    })

    it('puts the bar back and explains why when the save is rejected', async () => {
        await renderTab({
            onWrite: () => ({ status: 409, json: { error: { code: 'CONFLICT', message: 'x', key: 'macroPeriod.overlap' } } }),
        })

        act(() => timeline().onPeriodChange('a', { startDate: '2026-10-19', endDate: '2026-11-01' }))

        await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('errors:macroPeriod.overlap', 'error'))
        expect(timeline().periods).toEqual(PERIODS)
    })

    it('explains a drag refused because it overlaps', async () => {
        const calls = await renderTab()

        act(() => timeline().onPeriodConflict())

        expect(mocks.showToast).toHaveBeenCalledWith('planning.overlapToast', 'warning')
        expect(calls).toHaveLength(0)
    })

    it('edits a period from its dialog', async () => {
        const updated = { ...period('a', '2026-10-05', '2026-10-18', 'ph2'), note: 'Blocco 1' }
        const calls = await renderTab({ onWrite: () => ({ status: 200, json: { data: { period: updated } } }) })

        act(() => timeline().onPeriodClick('a'))
        const dialog = within(screen.getByRole('dialog'))
        fireEvent.change(dialog.getByLabelText(/planning\.phase/), { target: { value: 'ph2' } })
        fireEvent.change(dialog.getByLabelText('planning.note'), { target: { value: 'Blocco 1' } })
        fireEvent.click(dialog.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
        expect(calls[0]).toEqual({
            url: '/api/macro-periods/a',
            method: 'PATCH',
            body: { phaseTypeId: 'ph2', startDate: '2026-10-05', endDate: '2026-10-18', note: 'Blocco 1' },
        })
        expect(timeline().periods.find((item) => item.id === 'a')).toEqual(updated)
    })

    it('deletes a period after confirmation', async () => {
        const calls = await renderTab({ onWrite: () => ({ status: 200, json: { data: { id: 'a' } } }) })

        act(() => timeline().onPeriodClick('a'))
        fireEvent.click(within(screen.getByRole('dialog', { name: 'planning.editTitle' })).getByRole('button', { name: 'planning.deletePeriod' }))
        fireEvent.click(screen.getByRole('button', { name: /^planning\.deleteConfirm -/ }))

        await waitFor(() => expect(timeline().periods.map((item) => item.id)).toEqual(['b']))
        expect(calls[0]).toEqual({ url: '/api/macro-periods/a', method: 'DELETE', body: undefined })
        expect(screen.queryByRole('dialog', { name: 'planning.editTitle' })).not.toBeInTheDocument()
    })

    it('switches to the month view, keeps the left edge and remembers the choice', async () => {
        await renderTab()
        const start = timeline().visibleStart

        fireEvent.click(screen.getByRole('button', { name: 'planning.viewMonth' }))

        expect(timeline().view).toBe('month')
        expect(timeline().visibleStart).toBe(start)
        expect(timeline().visibleEnd - timeline().visibleStart).toBe(VIEW_SPAN_MS.month)
        expect(screen.getByRole('button', { name: 'planning.viewMonth' })).toHaveAttribute('aria-pressed', 'true')
        expect(window.localStorage.getItem('zc.planning.view')).toBe('month')
    })

    it('restores the remembered view', async () => {
        window.localStorage.setItem('zc.planning.view', 'month')

        await renderTab()

        await waitFor(() => expect(timeline().view).toBe('month'))
        expect(timeline().visibleEnd - timeline().visibleStart).toBe(VIEW_SPAN_MS.month)
    })

    it('falls back to weeks for a garbage stored view', async () => {
        window.localStorage.setItem('zc.planning.view', 'decade')

        await renderTab()

        expect(timeline().view).toBe('weeks')
    })

    it('moves the window with the navigation buttons and comes back with "today"', async () => {
        await renderTab()
        const start = timeline().visibleStart

        fireEvent.click(screen.getByRole('button', { name: 'planning.next' }))
        expect(timeline().visibleStart).toBe(start + 4 * WEEK_MS)

        fireEvent.click(screen.getByRole('button', { name: 'planning.previous' }))
        fireEvent.click(screen.getByRole('button', { name: 'planning.previous' }))
        expect(timeline().visibleStart).toBe(start - 4 * WEEK_MS)

        fireEvent.click(screen.getByRole('button', { name: 'planning.today' }))
        expect(timeline().visibleStart).toBe(start)
    })

    it('follows the timeline when it is panned', async () => {
        await renderTab()

        act(() => timeline().onVisibleRangeChange(1000, 1000 + VIEW_SPAN_MS.weeks))

        expect(timeline().visibleStart).toBe(1000)
    })

    it('opens a program from its bar through the navigation loader', async () => {
        await renderTab()

        act(() => timeline().onProgramClick('g1'))

        expect(mocks.startLoader).toHaveBeenCalledTimes(1)
        expect(mocks.push).toHaveBeenCalledWith('/trainer/programs/g1')
    })
})

import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/trainer-dashboard/activity-feed', () => ({ getActivityFeed: vi.fn() }))
vi.mock('@/lib/trainer-dashboard/new-records', () => ({ getNewRecords: vi.fn() }))
vi.mock('@/lib/trainer-dashboard/weekly-trend', () => ({ getWeeklyTrend: vi.fn() }))
vi.mock('@/lib/trainer-dashboard/consistency-ranking', () => ({ getConsistencyRanking: vi.fn() }))
vi.mock('recharts', () => {
    const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>
    return {
        ResponsiveContainer: Pass,
        ComposedChart: ({ children, data }: { children?: ReactNode; data?: unknown[] }) => (
            <div data-testid="trend-chart" data-points={JSON.stringify(data)}>{children}</div>
        ),
        Bar: ({ dataKey, name }: { dataKey: string; name: string }) => <div data-testid={`bar-${dataKey}`}>{name}</div>,
        Line: ({ dataKey, name }: { dataKey: string; name: string }) => <div data-testid={`line-${dataKey}`}>{name}</div>,
        XAxis: () => null,
        YAxis: () => null,
        CartesianGrid: () => null,
        Tooltip: () => null,
        Legend: () => null,
    }
})

import { getActivityFeed } from '@/lib/trainer-dashboard/activity-feed'
import { createTranslator } from '@/lib/trainer-dashboard/i18n'
import type { WidgetContext } from '@/app/trainer/dashboard/_widgets/types'
import ActivityFeedWidget from '@/app/trainer/dashboard/_widgets/ActivityFeedWidget'
import { getNewRecords } from '@/lib/trainer-dashboard/new-records'
import NewRecordsWidget from '@/app/trainer/dashboard/_widgets/NewRecordsWidget'
import { getWeeklyTrend } from '@/lib/trainer-dashboard/weekly-trend'
import WeeklyTrendWidget from '@/app/trainer/dashboard/_widgets/WeeklyTrendWidget'
import { getConsistencyRanking } from '@/lib/trainer-dashboard/consistency-ranking'
import ConsistencyRankingWidget from '@/app/trainer/dashboard/_widgets/ConsistencyRankingWidget'
import { NOW, TRAINEES, at, day } from './fixtures'

function makeCtx(overrides: Partial<WidgetContext> = {}): WidgetContext {
    return { trainerId: 'trainer-1', trainees: TRAINEES, now: NOW, locale: 'it', t: createTranslator('it'), ...overrides }
}

async function renderAsync(node: Promise<ReactNode>) {
    return render(<>{await node}</>)
}

const activity = (key: string, day: string, overrides: Partial<Awaited<ReturnType<typeof getActivityFeed>>[number]> = {}) => ({
    key, traineeId: 't1', traineeName: 'Anna Rossi', initials: 'AR', programId: 'p1', weekNumber: 2, dayIndex: 3,
    exerciseCount: 5, lastLoggedAt: at(`${day}T08:00:00`), day, hasRecord: false, ...overrides,
})

describe('ActivityFeedWidget', () => {
    it('groups sessions by day and describes each one', async () => {
        vi.mocked(getActivityFeed).mockResolvedValue([
            activity('a', '2026-10-03', { hasRecord: true }),
            activity('b', '2026-10-02', { traineeName: 'Luca Bianchi', initials: 'LB', exerciseCount: 1, programId: 'p2' }),
        ])

        await renderAsync(ActivityFeedWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Attività recente' })
        expect(getActivityFeed).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
        expect(within(region).getByRole('heading', { name: 'Oggi' })).toBeInTheDocument()
        expect(within(region).getByRole('heading', { name: 'Ieri' })).toBeInTheDocument()
        const [first, second] = within(region).getAllByRole('link')
        expect(first).toHaveAttribute('href', '/trainer/programs/p1')
        expect(first).toHaveTextContent('Anna Rossi ha completato Giorno 3 · Settimana 2')
        expect(first).toHaveTextContent('5 esercizi · 2 ore fa')
        expect(within(first).getByText('Nuovo record')).toBeInTheDocument()
        expect(second).toHaveTextContent('1 esercizio')
        expect(within(second).queryByText('Nuovo record')).not.toBeInTheDocument()
    })

    it('shows the empty state', async () => {
        vi.mocked(getActivityFeed).mockResolvedValue([])

        await renderAsync(ActivityFeedWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessun allenamento registrato negli ultimi 7 giorni.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getActivityFeed).mockRejectedValue(new Error('db down'))

        await renderAsync(ActivityFeedWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Attività recente' })).getByRole('alert')).toBeInTheDocument()
    })
})

describe('NewRecordsWidget', () => {
    it('shows each record with its improvement, or "first record"', async () => {
        vi.mocked(getNewRecords).mockResolvedValue([
            { id: 'r1', traineeName: 'Anna Rossi', exerciseName: 'Squat', reps: 1, weight: 142.5, recordDate: day('2026-10-02'), deltaKg: 5 },
            { id: 'r2', traineeName: 'Luca Bianchi', exerciseName: 'Panca', reps: 5, weight: 80, recordDate: day('2026-09-30'), deltaKg: null },
            { id: 'r3', traineeName: 'Luca Bianchi', exerciseName: 'Stacco', reps: 3, weight: 150, recordDate: day('2026-09-29'), deltaKg: 0 },
        ])

        await renderAsync(NewRecordsWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Nuovi record' })
        const items = within(region).getAllByRole('listitem')
        expect(getNewRecords).toHaveBeenCalledWith(TRAINEES, NOW)
        expect(items[0]).toHaveTextContent('Anna Rossi')
        expect(items[0]).toHaveTextContent('Squat')
        expect(items[0]).toHaveTextContent('142.5 kg × 1')
        expect(items[0]).toHaveTextContent('+5 kg')
        expect(items[1]).toHaveTextContent('Primo record')
        expect(items[2]).not.toHaveTextContent('+0 kg')
        expect(items[2]).not.toHaveTextContent('Primo record')
    })

    it('shows the encouraging empty state', async () => {
        vi.mocked(getNewRecords).mockResolvedValue([])

        await renderAsync(NewRecordsWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessun nuovo record questa settimana. La prossima è quella buona.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getNewRecords).mockRejectedValue(new Error('db down'))

        await renderAsync(NewRecordsWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Nuovi record' })).getByRole('alert')).toBeInTheDocument()
    })
})

describe('WeeklyTrendWidget', () => {
    const weeks = ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']

    it('summarises the current week and passes 8 labelled points to the chart', async () => {
        vi.mocked(getWeeklyTrend).mockResolvedValue(
            weeks.map((weekStart, index) => ({ weekStart, sessions: index === 7 ? 9 : index === 6 ? 12 : 4, volumeKg: 1000 * index })),
        )

        await renderAsync(WeeklyTrendWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Andamento ultime 8 settimane' })
        expect(getWeeklyTrend).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
        expect(within(region).getByText('9 sessioni questa settimana')).toBeInTheDocument()
        expect(within(region).getByText('-3 rispetto alla settimana scorsa')).toBeInTheDocument()
        const points = JSON.parse(within(region).getByTestId('trend-chart').getAttribute('data-points') ?? '[]')
        expect(points).toHaveLength(8)
        expect(points[0]).toEqual({ label: '10/08', sessions: 4, volumeKg: 0 })
        expect(points[7]).toEqual({ label: '28/09', sessions: 9, volumeKg: 7000 })
        expect(within(region).getByTestId('bar-sessions')).toHaveTextContent('Sessioni')
        expect(within(region).getByTestId('line-volumeKg')).toHaveTextContent('Volume (kg)')
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getWeeklyTrend).mockRejectedValue(new Error('db down'))

        await renderAsync(WeeklyTrendWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Andamento ultime 8 settimane' })).getByRole('alert')).toBeInTheDocument()
    })
})

describe('ConsistencyRankingWidget', () => {
    it('ranks trainees with medals for the top three and a sessions label', async () => {
        vi.mocked(getConsistencyRanking).mockResolvedValue([
            { traineeId: 't4', traineeName: 'Bruno Neri', sessions: 5, expected: 4, adherence: 1 },
            { traineeId: 't2', traineeName: 'Luca Bianchi', sessions: 3, expected: 4, adherence: 0.75 },
            { traineeId: 't1', traineeName: 'Anna Rossi', sessions: 6, expected: 12, adherence: 0.5 },
            { traineeId: 't5', traineeName: 'Carla Blu', sessions: 1, expected: 12, adherence: 1 / 12 },
        ])

        await renderAsync(ConsistencyRankingWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Classifica costanza' })
        const rows = within(region).getAllByRole('listitem')
        expect(getConsistencyRanking).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
        expect(rows).toHaveLength(4)
        expect(rows[0]).toHaveTextContent('Bruno Neri')
        expect(rows[0]).toHaveTextContent('5 / 4 sessioni')
        expect(rows[0]).toHaveTextContent('100%')
        expect(within(rows[0]).getByTestId('medal-1')).toBeInTheDocument()
        expect(within(rows[2]).getByTestId('medal-3')).toBeInTheDocument()
        expect(within(rows[3]).queryByTestId(/medal/)).not.toBeInTheDocument()
        expect(rows[3]).toHaveTextContent('4')
    })

    it('shows the empty state', async () => {
        vi.mocked(getConsistencyRanking).mockResolvedValue([])

        await renderAsync(ConsistencyRankingWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessun atleta con un programma attivo.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getConsistencyRanking).mockRejectedValue(new Error('db down'))

        await renderAsync(ConsistencyRankingWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Classifica costanza' })).getByRole('alert')).toBeInTheDocument()
    })
})

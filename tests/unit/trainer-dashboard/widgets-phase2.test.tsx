import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/trainer-dashboard/activity-feed', () => ({ getActivityFeed: vi.fn() }))
vi.mock('@/lib/trainer-dashboard/consistency-ranking', () => ({ getConsistencyRanking: vi.fn() }))

import { getActivityFeed } from '@/lib/trainer-dashboard/activity-feed'
import { createTranslator } from '@/lib/trainer-dashboard/i18n'
import type { WidgetContext } from '@/app/trainer/dashboard/_widgets/types'
import ActivityFeedWidget from '@/app/trainer/dashboard/_widgets/ActivityFeedWidget'
import { getConsistencyRanking } from '@/lib/trainer-dashboard/consistency-ranking'
import ConsistencyRankingWidget from '@/app/trainer/dashboard/_widgets/ConsistencyRankingWidget'
import { NOW, TRAINEES, at } from './fixtures'

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

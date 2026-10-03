import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/trainer-dashboard/header-kpis', () => ({ getHeaderKpis: vi.fn() }))
vi.mock('@/lib/trainer-dashboard/todo-today', () => ({ getTodoItems: vi.fn() }))
vi.mock('@/lib/trainer-dashboard/inactive-trainees', () => ({ getInactiveTrainees: vi.fn() }))
// DashboardHeader wraps the async HeaderKpis in <Suspense>; React 18 in jsdom cannot render
// an async component, so the header test replaces it with a static stand-in.
vi.mock('@/app/trainer/dashboard/_widgets/HeaderKpis', () => ({
    default: () => <div data-testid="header-kpis" />,
}))

import { getHeaderKpis } from '@/lib/trainer-dashboard/header-kpis'
import { createTranslator } from '@/lib/trainer-dashboard/i18n'
import type { WidgetContext } from '@/app/trainer/dashboard/_widgets/types'
import DashboardHeader from '@/app/trainer/dashboard/_widgets/DashboardHeader'
import { getTodoItems } from '@/lib/trainer-dashboard/todo-today'
import TodoTodayWidget from '@/app/trainer/dashboard/_widgets/TodoTodayWidget'
import { getInactiveTrainees } from '@/lib/trainer-dashboard/inactive-trainees'
import InactiveTraineesWidget from '@/app/trainer/dashboard/_widgets/InactiveTraineesWidget'
import { NOW, TRAINEES } from './fixtures'

const { default: HeaderKpis } = await vi.importActual<typeof import('@/app/trainer/dashboard/_widgets/HeaderKpis')>(
    '@/app/trainer/dashboard/_widgets/HeaderKpis',
)

function makeCtx(overrides: Partial<WidgetContext> = {}): WidgetContext {
    return { trainerId: 'trainer-1', trainees: TRAINEES, now: NOW, locale: 'it', t: createTranslator('it'), ...overrides }
}

async function renderAsync(node: Promise<ReactNode>) {
    return render(<>{await node}</>)
}

describe('DashboardHeader', () => {
    it('greets the trainer, shows today and the quick actions', () => {
        render(<DashboardHeader ctx={makeCtx()} firstName="Edo" />)

        expect(screen.getByRole('heading', { level: 1, name: 'Buon pomeriggio, Edo' })).toBeInTheDocument()
        expect(screen.getByText(/3 ottobre 2026/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /nuovo programma/i })).toHaveAttribute('href', '/trainer/programs/new')
        expect(screen.getByRole('link', { name: /nuovo atleta/i })).toHaveAttribute('href', '/trainer/trainees/new')
        expect(screen.getByTestId('header-kpis')).toBeInTheDocument()
    })
})

describe('HeaderKpis', () => {
    it('renders the three KPIs with a positive week delta', async () => {
        vi.mocked(getHeaderKpis).mockResolvedValue({
            activeTrainees: 4,
            totalTrainees: 6,
            activePrograms: 5,
            sessionsThisWeek: 9,
            sessionsLastWeek: 7,
        })

        await renderAsync(HeaderKpis({ ctx: makeCtx() }))

        expect(getHeaderKpis).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
        expect(screen.getByText('Atleti attivi (7 gg)').closest('div')).toHaveTextContent('4 / 6')
        expect(screen.getByText('Programmi attivi').closest('div')).toHaveTextContent('5')
        expect(screen.getByText('+2 rispetto alla settimana scorsa')).toBeInTheDocument()
    })

    it('shows a negative delta without a plus sign', async () => {
        vi.mocked(getHeaderKpis).mockResolvedValue({
            activeTrainees: 1, totalTrainees: 1, activePrograms: 1, sessionsThisWeek: 1, sessionsLastWeek: 4,
        })

        await renderAsync(HeaderKpis({ ctx: makeCtx() }))

        expect(screen.getByText('-3 rispetto alla settimana scorsa')).toBeInTheDocument()
    })

    it('degrades to a notice when the KPIs fail to load', async () => {
        vi.mocked(getHeaderKpis).mockRejectedValue(new Error('db down'))

        await renderAsync(HeaderKpis({ ctx: makeCtx() }))

        expect(screen.getByRole('alert')).toHaveTextContent('Indicatori non disponibili al momento.')
    })
})

describe('TodoTodayWidget', () => {
    it('lists every item with its text and link, and shows the count', async () => {
        vi.mocked(getTodoItems).mockResolvedValue([
            { kind: 'subscriptionExpired', traineeId: 't1', traineeName: 'Anna Rossi', days: 2 },
            { kind: 'subscriptionExpiring', traineeId: 't2', traineeName: 'Luca Bianchi', days: 1 },
            { kind: 'testsToReview', programId: 'p1', traineeName: 'Anna Rossi', weekNumber: 4 },
            { kind: 'programEnding', programId: 'p2', traineeId: 't2', traineeName: 'Luca Bianchi', programTitle: 'Forza', days: 3 },
            { kind: 'testWeekInProgress', programId: 'p3', traineeName: 'Sara Verdi', weekNumber: 6, completed: 1, planned: 3 },
        ])

        await renderAsync(TodoTodayWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Da fare oggi' })
        const links = within(region).getAllByRole('link')
        expect(getTodoItems).toHaveBeenCalledWith('trainer-1', NOW)
        expect(within(region).getByText('5')).toBeInTheDocument()
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/trainer/subscriptions',
            '/trainer/subscriptions',
            '/trainer/programs/p1/tests?backContext=dashboard',
            '/trainer/programs/new',
            '/trainer/programs/p3',
        ])
        expect(links[0]).toHaveTextContent('Abbonamento scaduto da 2 giorni')
        expect(links[1]).toHaveTextContent('Abbonamento in scadenza domani')
        expect(links[2]).toHaveTextContent('Test completati da revisionare · Settimana 4')
        expect(links[3]).toHaveTextContent('Forza termina tra 3 giorni, nessun programma successivo')
        expect(links[4]).toHaveTextContent('Settimana di test in corso · Settimana 6')
        expect(within(links[4]).getByText('Test completati')).toBeInTheDocument()
    })

    it('shows the all-clear state when there is nothing to do', async () => {
        vi.mocked(getTodoItems).mockResolvedValue([])

        await renderAsync(TodoTodayWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Tutto in ordine: nessuna azione richiesta.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getTodoItems).mockRejectedValue(new Error('db down'))

        await renderAsync(TodoTodayWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Da fare oggi' })).getByRole('alert')).toHaveTextContent(
            'Impossibile caricare questa sezione',
        )
    })
})

describe('InactiveTraineesWidget', () => {
    it('links each inactive trainee to their profile and shows how long they have been silent', async () => {
        vi.mocked(getInactiveTrainees).mockResolvedValue({
            total: 8,
            items: [
                { traineeId: 't5', traineeName: 'Carla Blu', initials: 'CB', daysSinceLastSession: null },
                { traineeId: 't2', traineeName: 'Luca Bianchi', initials: 'LB', daysSinceLastSession: 13 },
                { traineeId: 't4', traineeName: 'Bruno Neri', initials: 'BN', daysSinceLastSession: 1 },
            ],
        })

        await renderAsync(InactiveTraineesWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Atleti inattivi' })
        expect(getInactiveTrainees).toHaveBeenCalledWith(TRAINEES, NOW)
        expect(within(region).getByRole('link', { name: /Carla Blu/ })).toHaveAttribute('href', '/trainer/trainees/t5')
        expect(within(region).getByText('Nessun allenamento registrato')).toBeInTheDocument()
        expect(within(region).getByText('Ultimo allenamento 13 giorni fa')).toBeInTheDocument()
        expect(within(region).getByText('Ultimo allenamento ieri')).toBeInTheDocument()
        expect(within(region).getByRole('link', { name: '+5 altri' })).toHaveAttribute('href', '/trainer/trainees')
    })

    it('shows the empty state', async () => {
        vi.mocked(getInactiveTrainees).mockResolvedValue({ items: [], total: 0 })

        await renderAsync(InactiveTraineesWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Tutti gli atleti con un programma attivo si sono allenati di recente.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getInactiveTrainees).mockRejectedValue(new Error('db down'))

        await renderAsync(InactiveTraineesWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Atleti inattivi' })).getByRole('alert')).toBeInTheDocument()
    })
})

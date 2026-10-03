import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/trainer-dashboard/header-kpis', () => ({ getHeaderKpis: vi.fn() }))
vi.mock('@/lib/trainer-dashboard/program-ending', () => ({ getEndingPrograms: vi.fn() }))
vi.mock('@/lib/trainer-dashboard/subscription-alerts', () => ({ getSubscriptionAlerts: vi.fn() }))
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
import { getEndingPrograms } from '@/lib/trainer-dashboard/program-ending'
import ProgramEndingWidget from '@/app/trainer/dashboard/_widgets/ProgramEndingWidget'
import { getSubscriptionAlerts, type SubscriptionAlert } from '@/lib/trainer-dashboard/subscription-alerts'
import SubscriptionAlertsWidget from '@/app/trainer/dashboard/_widgets/SubscriptionAlertsWidget'
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

describe('ProgramEndingWidget', () => {
    it('lists each ending program with its countdown, last-week progress and link, and shows the count', async () => {
        vi.mocked(getEndingPrograms).mockResolvedValue([
            { programId: 'p1', traineeId: 't1', traineeName: 'Anna Rossi', programTitle: 'Forza', days: 0, completed: 2, planned: 4 },
            { programId: 'p2', traineeId: 't2', traineeName: 'Luca Bianchi', programTitle: 'Ipertrofia', days: 3, completed: 0, planned: 0 },
        ])

        await renderAsync(ProgramEndingWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Programmi in chiusura' })
        const links = within(region).getAllByRole('link')
        expect(getEndingPrograms).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
        expect(within(region).getByText('2')).toBeInTheDocument()
        expect(links.map((link) => link.getAttribute('href'))).toEqual(['/trainer/programs/new', '/trainer/programs/new'])
        expect(links[0]).toHaveTextContent('Forza termina oggi')
        expect(links[0]).toHaveTextContent('50%')
        expect(within(links[0]).getByRole('progressbar', { name: 'Ultima settimana' })).toBeInTheDocument()
        expect(links[1]).toHaveTextContent('Ipertrofia termina tra 3 giorni')
        // no planned workouts in the last week: no progress bar
        expect(within(links[1]).queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('shows the empty state when no program is ending', async () => {
        vi.mocked(getEndingPrograms).mockResolvedValue([])

        await renderAsync(ProgramEndingWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessun programma in chiusura senza un programma successivo.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getEndingPrograms).mockRejectedValue(new Error('db down'))

        await renderAsync(ProgramEndingWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Programmi in chiusura' })).getByRole('alert')).toHaveTextContent(
            'Impossibile caricare questa sezione',
        )
    })
})

describe('SubscriptionAlertsWidget', () => {
    const alert = (index: number, status: SubscriptionAlert['status'] = 'expiring'): SubscriptionAlert => ({
        status,
        traineeId: `t${index}`,
        traineeName: `Atleta ${index}`,
        days: index,
    })

    it('lists expired and expiring subscriptions linking to the subscriptions page', async () => {
        vi.mocked(getSubscriptionAlerts).mockResolvedValue([
            { status: 'expired', traineeId: 't1', traineeName: 'Anna Rossi', days: 2 },
            { status: 'expiring', traineeId: 't2', traineeName: 'Luca Bianchi', days: 1 },
        ])

        await renderAsync(SubscriptionAlertsWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Abbonamenti' })
        const links = within(region).getAllByRole('link')
        expect(getSubscriptionAlerts).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
        expect(links.map((link) => link.getAttribute('href'))).toEqual(['/trainer/subscriptions', '/trainer/subscriptions'])
        expect(links[0]).toHaveTextContent('Scaduto da 2 giorni')
        expect(links[1]).toHaveTextContent('In scadenza domani')
        expect(within(region).queryByRole('button')).not.toBeInTheDocument()
    })

    it('pages through more than 6 rows', async () => {
        vi.mocked(getSubscriptionAlerts).mockResolvedValue(Array.from({ length: 8 }, (_, index) => alert(index + 1)))

        await renderAsync(SubscriptionAlertsWidget({ ctx: makeCtx() }))

        const region = screen.getByRole('region', { name: 'Abbonamenti' })
        const previous = within(region).getByRole('button', { name: 'Pagina precedente' })
        const next = within(region).getByRole('button', { name: 'Pagina successiva' })
        expect(within(region).getByText('8')).toBeInTheDocument()
        expect(within(region).getAllByRole('link')).toHaveLength(6)
        expect(within(region).getByText('1 / 2')).toBeInTheDocument()
        expect(previous).toBeDisabled()

        fireEvent.click(next)

        expect(within(region).getAllByRole('link').map((link) => link.textContent)).toEqual([
            expect.stringContaining('Atleta 7'),
            expect.stringContaining('Atleta 8'),
        ])
        expect(within(region).getByText('2 / 2')).toBeInTheDocument()
        expect(next).toBeDisabled()

        fireEvent.click(previous)

        expect(within(region).getAllByRole('link')).toHaveLength(6)
    })

    it('shows the empty state when no subscription needs attention', async () => {
        vi.mocked(getSubscriptionAlerts).mockResolvedValue([])

        await renderAsync(SubscriptionAlertsWidget({ ctx: makeCtx() }))

        expect(screen.getByText('Nessun abbonamento scaduto o in scadenza.')).toBeInTheDocument()
    })

    it('shows the error card when loading fails', async () => {
        vi.mocked(getSubscriptionAlerts).mockRejectedValue(new Error('db down'))

        await renderAsync(SubscriptionAlertsWidget({ ctx: makeCtx() }))

        expect(within(screen.getByRole('region', { name: 'Abbonamenti' })).getByRole('alert')).toHaveTextContent(
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
        expect(getInactiveTrainees).toHaveBeenCalledWith('trainer-1', TRAINEES, NOW)
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

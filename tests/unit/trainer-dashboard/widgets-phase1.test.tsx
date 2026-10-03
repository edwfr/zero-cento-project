import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/lib/trainer-dashboard/header-kpis', () => ({ getHeaderKpis: vi.fn() }))
// DashboardHeader wraps the async HeaderKpis in <Suspense>; React 18 in jsdom cannot render
// an async component, so the header test replaces it with a static stand-in.
vi.mock('@/app/trainer/dashboard/_widgets/HeaderKpis', () => ({
    default: () => <div data-testid="header-kpis" />,
}))

import { getHeaderKpis } from '@/lib/trainer-dashboard/header-kpis'
import { createTranslator } from '@/lib/trainer-dashboard/i18n'
import type { WidgetContext } from '@/app/trainer/dashboard/_widgets/types'
import DashboardHeader from '@/app/trainer/dashboard/_widgets/DashboardHeader'
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

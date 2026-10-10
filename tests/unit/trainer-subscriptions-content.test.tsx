import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import TrainerSubscriptionsContent from '@/app/trainer/subscriptions/_content'
import type { SubscriptionOverview } from '@/lib/subscriptions'

const overview: SubscriptionOverview = {
    withSubscription: [
        { traineeId: 'rossi', firstName: 'Anna', lastName: 'Rossi', subscription: { kind: 'period', status: 'expired', endDate: '2026-10-01T00:00:00.000Z', daysLeft: -2 } },
        { traineeId: 'verdi', firstName: 'Sara', lastName: 'Verdi', subscription: { kind: 'period', status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 } },
        { traineeId: 'bianchi', firstName: 'Luca', lastName: 'Bianchi', subscription: { kind: 'period', status: 'active', endDate: '2026-12-01T00:00:00.000Z', daysLeft: 59 } },
    ],
    withoutSubscription: [{ traineeId: 'neri', firstName: 'Paolo', lastName: 'Neri', subscription: null }],
    counts: { expired: 1, expiring: 1, active: 1, none: 1 },
}

describe('TrainerSubscriptionsContent', () => {
    it('shows the four counters', () => {
        render(<TrainerSubscriptionsContent overview={overview} />)

        for (const key of ['expired', 'expiring', 'active', 'none']) {
            const counter = screen.getByTestId(`subscription-counter-${key}`)
            expect(counter).toHaveTextContent('1')
        }
    })

    it('keeps the server order (soonest expiry first) and links to the subscription tab', () => {
        render(<TrainerSubscriptionsContent overview={overview} />)

        const list = screen.getByRole('list', { name: 'subscriptions.page.listTitle' })
        const links = within(list).getAllByRole('link')
        expect(links.map((link) => link.textContent)).toEqual([
            expect.stringContaining('Anna Rossi'),
            expect.stringContaining('Sara Verdi'),
            expect.stringContaining('Luca Bianchi'),
        ])
        expect(links[0]).toHaveAttribute('href', '/trainer/trainees/rossi?tab=subscription')
    })

    it('lists trainees without a subscription in their own block', () => {
        render(<TrainerSubscriptionsContent overview={overview} />)

        const block = screen.getByRole('list', { name: 'subscriptions.page.noneTitle' })
        expect(within(block).getByRole('link')).toHaveTextContent('Paolo Neri')
    })

    it('shows the empty state without active trainees', () => {
        render(
            <TrainerSubscriptionsContent
                overview={{ withSubscription: [], withoutSubscription: [], counts: { expired: 0, expiring: 0, active: 0, none: 0 } }}
            />
        )

        expect(screen.getByText('subscriptions.page.empty')).toBeInTheDocument()
    })

    it('shows the balance instead of a date for a package trainee', () => {
        render(
            <TrainerSubscriptionsContent
                overview={{
                    withSubscription: [
                        { traineeId: 'p1', firstName: 'Pia', lastName: 'Verdi', subscription: { kind: 'programs', status: 'expiring', remaining: 1 } },
                    ],
                    withoutSubscription: [],
                    counts: { expired: 0, expiring: 1, active: 0, none: 0 },
                }}
            />
        )

        const row = screen.getByRole('link', { name: /Pia Verdi/ })
        expect(within(row).getAllByText('subscriptions.programs.last').length).toBeGreaterThan(0)
        expect(within(row).getByText('—')).toBeInTheDocument()
    })
})

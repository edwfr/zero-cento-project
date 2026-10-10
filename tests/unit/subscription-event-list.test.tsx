import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import SubscriptionEventList from '@/components/SubscriptionEventList'
import type { SubscriptionEventRow } from '@/lib/subscriptions'

const event = (overrides: Partial<SubscriptionEventRow>): SubscriptionEventRow => ({
    id: 'e1',
    type: 'package_created',
    creditDelta: 5,
    details: { purchaseDate: '2026-10-01', programCount: 5 },
    createdAt: '2026-10-01T10:00:00.000Z',
    actorName: 'Marco Trainer',
    ...overrides,
})

describe('SubscriptionEventList', () => {
    it('shows the empty state without events', () => {
        render(<SubscriptionEventList events={[]} />)

        expect(screen.getByText('subscriptions.events.empty')).toBeInTheDocument()
    })

    it('renders one row per event with description, signed delta and author', () => {
        render(
            <SubscriptionEventList
                events={[
                    event({ id: 'e2', type: 'credit_consumed', creditDelta: -1, details: { programTitle: 'Forza A' } }),
                    event({ id: 'e1' }),
                ]}
            />
        )

        const rows = screen.getAllByRole('listitem')
        expect(rows).toHaveLength(2)
        expect(within(rows[0]).getByText('subscriptions.events.types.credit_consumed')).toBeInTheDocument()
        expect(within(rows[0]).getByText('−1')).toBeInTheDocument()
        expect(within(rows[1]).getByText('+5')).toBeInTheDocument()
        expect(within(rows[1]).getByText(/Marco Trainer/)).toBeInTheDocument()
    })

    it('shows no delta for a period renewal or a forfeited credit', () => {
        render(
            <SubscriptionEventList
                events={[
                    event({
                        id: 'e1',
                        type: 'period_renewal_created',
                        creditDelta: null,
                        details: { startDate: '2026-09-10', durationMonths: 1, endDate: '2026-10-10' },
                    }),
                    event({ id: 'e2', type: 'credit_forfeited', creditDelta: 0, details: { programTitle: 'Forza A' } }),
                ]}
            />
        )

        expect(screen.queryByTestId('event-delta')).not.toBeInTheDocument()
    })

    it('falls back to a generic line for a type it does not know', () => {
        render(<SubscriptionEventList events={[event({ type: 'something_new' as never, creditDelta: null, details: {} })]} />)

        expect(screen.getByText('subscriptions.events.types.unknown')).toBeInTheDocument()
    })

    it('does not crash when details lack the expected fields', () => {
        render(<SubscriptionEventList events={[event({ type: 'credit_consumed', creditDelta: -1, details: {} })]} />)

        expect(screen.getByText('subscriptions.events.types.credit_consumed')).toBeInTheDocument()
    })
})

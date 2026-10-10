import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubscriptionStatusBadge from '@/components/SubscriptionStatusBadge'

const END = '2026-10-10T00:00:00.000Z'

describe('SubscriptionStatusBadge', () => {
    it.each([
        ['expiring', 7, 'subscriptions.badge.expiring'],
        ['expired', -2, 'subscriptions.badge.expired'],
        ['active', 40, 'subscriptions.badge.active'],
    ] as const)('renders the %s variant', (status, daysLeft, key) => {
        render(<SubscriptionStatusBadge summary={{ kind: 'period' as const, status, endDate: END, daysLeft }} />)

        const badge = screen.getByText(key)
        expect(badge.closest('[data-status]')).toHaveAttribute('data-status', status)
    })

    it('renders the none variant without a subscription', () => {
        render(<SubscriptionStatusBadge summary={null} />)

        expect(screen.getByText('subscriptions.badge.none')).toBeInTheDocument()
    })

    it('renders nothing in compact mode for active or missing subscriptions', () => {
        const { container: active } = render(
            <SubscriptionStatusBadge compact summary={{ kind: 'period', status: 'active', endDate: END, daysLeft: 40 }} />
        )
        const { container: none } = render(<SubscriptionStatusBadge compact summary={null} />)

        expect(active).toBeEmptyDOMElement()
        expect(none).toBeEmptyDOMElement()
    })

    it('still renders expiring subscriptions in compact mode', () => {
        render(<SubscriptionStatusBadge compact summary={{ kind: 'period', status: 'expiring', endDate: END, daysLeft: 3 }} />)

        expect(screen.getByText('subscriptions.badge.expiring')).toBeInTheDocument()
    })

    it.each([
        [3, 'active', 'subscriptions.programs.available'],
        [1, 'expiring', 'subscriptions.programs.last'],
        [0, 'expired', 'subscriptions.programs.exhausted'],
        [-2, 'expired', 'subscriptions.programs.debt'],
    ] as const)('renders a program balance of %i as %s', (remaining, status, key) => {
        render(<SubscriptionStatusBadge summary={{ kind: 'programs', status, remaining }} />)

        expect(screen.getByText(key).closest('[data-status]')).toHaveAttribute('data-status', status)
    })
})

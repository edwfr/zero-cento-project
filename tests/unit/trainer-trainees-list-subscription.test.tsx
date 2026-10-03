import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
    ToastProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

import TrainerTraineesContent from '@/app/trainer/trainees/_content'

const base = { email: 'x@x.it', createdAt: '2026-01-01T00:00:00.000Z' }
const items = [
    { ...base, id: 't1', firstName: 'Anna', lastName: 'Rossi', isActive: true, subscription: { status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 } },
    { ...base, id: 't2', firstName: 'Luca', lastName: 'Bianchi', isActive: true, subscription: { status: 'active', endDate: '2027-01-10T00:00:00.000Z', daysLeft: 99 } },
    { ...base, id: 't3', firstName: 'Sara', lastName: 'Verdi', isActive: false, subscription: { status: 'expired', endDate: '2026-09-10T00:00:00.000Z', daysLeft: -23 } },
]

describe('Trainer trainee list — subscription icon', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    items,
                    statusCounts: { all: 3, active: 2, inactive: 1 },
                    pagination: { nextCursor: null, hasMore: false, currentPage: 1, totalPages: 1, totalItems: 3, limit: 20 },
                },
            }),
        }) as never
    })

    it('shows the status icon for every active trainee, none for inactive ones', async () => {
        render(<TrainerTraineesContent />)

        expect(await screen.findByText('Anna Rossi')).toBeInTheDocument()
        const statuses = screen
            .getAllByRole('img')
            .map((el) => el.getAttribute('data-status'))
            .filter(Boolean)
        expect(statuses).toEqual(['expiring', 'active']) // Sara is inactive
        expect(screen.queryByRole('button', { name: /subscriptions\.badge/ })).not.toBeInTheDocument()
    })
})

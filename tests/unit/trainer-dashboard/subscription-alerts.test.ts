import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/subscription-queries', () => ({ getTrainerSubscriptionOverview: vi.fn() }))

import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { getSubscriptionAlerts } from '@/lib/trainer-dashboard/subscription-alerts'
import type { SubscriptionOverview } from '@/lib/subscriptions'
import { NOW, TRAINEES, day, makeTrainee } from './fixtures'

const subscribed = (traineeId: string, firstName: string, status: 'active' | 'expiring' | 'expired', daysLeft: number) => ({
    traineeId,
    firstName,
    lastName: 'X',
    subscription: { status, daysLeft, endDate: '2026-10-10T00:00:00.000Z' },
})

function arrange(items: SubscriptionOverview['withSubscription']) {
    vi.mocked(getTrainerSubscriptionOverview).mockResolvedValue({
        withSubscription: items,
        withoutSubscription: [],
        counts: { none: 0, active: 0, expiring: 0, expired: 0 },
    })
}

describe('getSubscriptionAlerts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reads the subscription overview for today', async () => {
        arrange([])

        await expect(getSubscriptionAlerts('trainer-1', TRAINEES, NOW)).resolves.toEqual([])

        expect(getTrainerSubscriptionOverview).toHaveBeenCalledWith('trainer-1', day('2026-10-03'))
    })

    it('keeps expired and expiring subscriptions, ignoring active ones', async () => {
        arrange([subscribed('t1', 'Zoe', 'expired', -3), subscribed('t2', 'Bea', 'expiring', 0), subscribed('t3', 'Ada', 'active', 40)])

        await expect(getSubscriptionAlerts('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            { status: 'expired', traineeId: 't1', traineeName: 'Zoe X', days: 3 },
            { status: 'expiring', traineeId: 't2', traineeName: 'Bea X', days: 0 },
        ])
    })

    it('puts the longest-expired first, then the ones expiring soonest, then by name', async () => {
        arrange([
            subscribed('t1', 'Zoe', 'expiring', 5),
            subscribed('t2', 'Ada', 'expiring', 9),
            subscribed('t3', 'Max', 'expired', -1),
            subscribed('t4', 'Kim', 'expired', -12),
            subscribed('t5', 'Bob', 'expiring', 5),
        ])

        const items = await getSubscriptionAlerts('trainer-1', TRAINEES, NOW)

        expect(items.map((item) => item.traineeName)).toEqual(['Kim X', 'Max X', 'Bob X', 'Zoe X', 'Ada X'])
    })

    it('does not query without active trainees', async () => {
        await expect(getSubscriptionAlerts('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(getTrainerSubscriptionOverview).not.toHaveBeenCalled()
    })
})

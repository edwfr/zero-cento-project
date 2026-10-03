import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { startOfUtcDay } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface SubscriptionAlert {
    status: 'expired' | 'expiring'
    traineeId: string
    traineeName: string
    /** Days since expiry when expired, days left when expiring */
    days: number
}

export async function getSubscriptionAlerts(
    trainerId: string,
    trainees: DashboardTrainee[],
    now: Date,
): Promise<SubscriptionAlert[]> {
    if (activeTraineeIds(trainees).length === 0) return []

    const overview = await getTrainerSubscriptionOverview(trainerId, startOfUtcDay(now))

    // daysLeft ascending: longest-expired first, then the ones expiring soonest
    return overview.withSubscription
        .filter((entry) => entry.subscription.status === 'expired' || entry.subscription.status === 'expiring')
        .sort(
            (left, right) =>
                left.subscription.daysLeft - right.subscription.daysLeft || fullName(left).localeCompare(fullName(right)),
        )
        .map((entry) => ({
            status: entry.subscription.status === 'expired' ? 'expired' : 'expiring',
            traineeId: entry.traineeId,
            traineeName: fullName(entry),
            days: Math.abs(entry.subscription.daysLeft),
        }))
}

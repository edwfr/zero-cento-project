import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { compareOverviewItems, needsAttention, type RenewalKind } from '@/lib/subscriptions'
import { startOfUtcDay } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface SubscriptionAlert {
    kind: RenewalKind
    status: 'expired' | 'expiring'
    traineeId: string
    traineeName: string
    /** period: days since expiry / days left. programs: programs owed (0 = just exhausted) / programs left */
    value: number
}

export async function getSubscriptionAlerts(
    trainerId: string,
    trainees: DashboardTrainee[],
    now: Date,
): Promise<SubscriptionAlert[]> {
    if (activeTraineeIds(trainees).length === 0) return []

    const overview = await getTrainerSubscriptionOverview(trainerId, startOfUtcDay(now))

    // Same order as the subscriptions page: red first, then amber, most urgent first
    return overview.withSubscription
        .filter((entry) => needsAttention(entry.subscription))
        .sort((left, right) => compareOverviewItems(left, right) || fullName(left).localeCompare(fullName(right)))
        .map((entry) => ({
            kind: entry.subscription.kind,
            status: entry.subscription.status === 'expired' ? 'expired' : 'expiring',
            traineeId: entry.traineeId,
            traineeName: fullName(entry),
            value: Math.abs(
                entry.subscription.kind === 'period' ? entry.subscription.daysLeft : entry.subscription.remaining
            ),
        }))
}

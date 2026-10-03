import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { getTodayDateKey } from '@/lib/date-format'
import TrainerSubscriptionsContent from './_content'

export default async function TrainerSubscriptionsPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainer') {
        redirect(`/${session.user.role}/dashboard`)
    }

    // Scoped to the logged-in trainer: each trainer sees only their own athletes
    const overview = await getTrainerSubscriptionOverview(session.user.id, getTodayDateKey())

    return (
        <DashboardLayout user={session.user} backHref="/trainer/dashboard">
            <TrainerSubscriptionsContent overview={overview} />
        </DashboardLayout>
    )
}

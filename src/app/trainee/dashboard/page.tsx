import { getSessionIncludingInactive } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import TraineeDashboardContent from './_content'

export default async function TraineeDashboard() {
    const session = await getSessionIncludingInactive()

    if (!session) {
        redirect('/login')
    }

    if (!session.user.isActive) {
        redirect('/account-inactive')
    }

    if (session.user.role !== 'trainee') {
        redirect(`/${session.user.role}/dashboard`)
    }

    return (
        <DashboardLayout user={session.user}>
            <TraineeDashboardContent />
        </DashboardLayout>
    )
}

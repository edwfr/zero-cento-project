import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import DashboardLayout from '@/components/DashboardLayout'
import TrainerTemplatesContent from './_content'

export default async function TrainerTemplatesPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainer') {
        redirect(`/${session.user.role}/dashboard`)
    }

    return (
        <DashboardLayout user={session.user} backHref="/trainer/dashboard">
            <TrainerTemplatesContent />
        </DashboardLayout>
    )
}

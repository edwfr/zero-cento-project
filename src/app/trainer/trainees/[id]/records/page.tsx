import DashboardLayout from '@/components/DashboardLayout'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import TraineeRecordsContent from './_content'

interface TraineeRecordsManagementPageProps {
    params?: Promise<{ id: string }>
}

export default async function TraineeRecordsManagementPage({ params }: TraineeRecordsManagementPageProps) {
    const resolvedParams = await params
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainer') {
        redirect(`/${session.user.role}/dashboard`)
    }

    const backHref = resolvedParams?.id ? `/trainer/trainees/${resolvedParams.id}` : '/trainer/trainees'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <TraineeRecordsContent />
        </DashboardLayout>
    )
}

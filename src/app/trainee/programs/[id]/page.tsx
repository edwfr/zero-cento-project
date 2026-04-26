import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ProgramDetailByIdContent from './_content'

interface ProgramDetailByIdPageProps {
    params: Promise<{ id: string }>
}

export default async function ProgramDetailByIdPage({ params }: ProgramDetailByIdPageProps) {
    const { id } = await params
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainee') {
        redirect(`/${session.user.role}/dashboard`)
    }

    return (
        <DashboardLayout user={session.user} backHref="/trainee/history">
            <ProgramDetailByIdContent programId={id} />
        </DashboardLayout>
    )
}

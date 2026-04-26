import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PublishProgramContent from './_content'

interface PublishProgramPageProps {
    params?: Promise<{ id: string }>
}

export default async function PublishProgramPage({ params }: PublishProgramPageProps) {
    const resolvedParams = await params
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    const backHref = resolvedParams?.id ? `/trainer/programs/${resolvedParams.id}/review` : '/trainer/programs'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <PublishProgramContent />
        </DashboardLayout>
    )
}

import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import EditProgramContent from './_content'

interface EditProgramPageProps {
    searchParams?: Promise<{ backContext?: string; traineeId?: string }>
}

export default async function EditProgramPage({ searchParams }: EditProgramPageProps) {
    const resolvedSearchParams = await searchParams
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    const backContext = resolvedSearchParams?.backContext
    const traineeId = resolvedSearchParams?.traineeId
    const backHref =
        backContext === 'trainee' && traineeId
            ? `/trainer/trainees/${traineeId}`
            : '/trainer/programs'

    return (
        <DashboardLayout user={session.user} backHref={backHref}>
            <EditProgramContent readOnly={false} />
        </DashboardLayout>
    )
}

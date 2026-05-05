import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import CurrentProgramContent from './_content'
import { loadActiveProgramId, loadTraineeProgramView } from '@/lib/trainee-program-data'

interface CurrentProgramPageProps {
    searchParams?: Promise<{ programId?: string }>
}

export default async function CurrentProgramPage({ searchParams }: CurrentProgramPageProps) {
    const resolvedSearchParams = await searchParams
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainee') {
        redirect(`/${session.user.role}/dashboard`)
    }

    const requestedProgramId = resolvedSearchParams?.programId
    const programId = await loadActiveProgramId(session.user.id, requestedProgramId)

    if (!programId) {
        redirect('/trainee/programs')
    }

    const programView = await loadTraineeProgramView({
        programId,
        traineeId: session.user.id,
    })

    if (!programView) {
        redirect('/trainee/programs')
    }

    return (
        <DashboardLayout user={session.user} backHref="/trainee/dashboard">
            <CurrentProgramContent initialData={programView} />
        </DashboardLayout>
    )
}
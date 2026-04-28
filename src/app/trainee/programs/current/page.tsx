import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import CurrentProgramContent from './_content'
import { loadActiveProgramId, loadTraineeProgramView } from '@/lib/trainee-program-data'

export default async function CurrentProgramPage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainee') {
        redirect(`/${session.user.role}/dashboard`)
    }

    const programId = await loadActiveProgramId(session.user.id)

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
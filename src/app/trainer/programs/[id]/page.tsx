import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import EditProgramContent from './edit/_content'

export default async function ViewProgramPage() {
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    return (
        <DashboardLayout user={session.user}>
            <EditProgramContent readOnly={true} />
        </DashboardLayout>
    )
}

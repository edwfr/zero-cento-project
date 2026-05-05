import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ReviewProgramContent from './review/_content'

export default async function ViewProgramPage() {
    const session = await getSession()
    if (!session) redirect('/login')
    if (session.user.role !== 'trainer') redirect(`/${session.user.role}/dashboard`)

    return (
        <DashboardLayout user={session.user}>
            <ReviewProgramContent viewOnly={true} />
        </DashboardLayout>
    )
}

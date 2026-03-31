import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import ChangePasswordContent from './_content'

export default async function ChangePasswordPage() {
    const session = await getSession()
    if (!session) redirect('/login')

    return (
        <DashboardLayout user={session.user}>
            <ChangePasswordContent />
        </DashboardLayout>
    )
}

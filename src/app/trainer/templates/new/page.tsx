import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import DashboardLayout from '@/components/DashboardLayout'
import WorkoutTemplateEditor from '@/components/WorkoutTemplateEditor'

export default async function NewTemplatePage() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    if (session.user.role !== 'trainer') {
        redirect(`/${session.user.role}/dashboard`)
    }

    return (
        <DashboardLayout user={session.user} backHref="/trainer/templates">
            <WorkoutTemplateEditor />
        </DashboardLayout>
    )
}

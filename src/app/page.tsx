import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

/**
 * Root page - redirects to appropriate dashboard based on user role
 * or to login if not authenticated
 */
export default async function Home() {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    // Redirect to role-based dashboard
    redirect(`/${session.user.role}/dashboard`)
}

import { redirect } from 'next/navigation'

/**
 * Root page - redirects to appropriate dashboard based on user role
 * The middleware will handle authentication and redirect to login if needed
 */
export default function Home() {
  // Middleware handles redirect to role-based dashboard
  redirect('/login')
}

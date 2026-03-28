import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase Browser Client
 * Used in Client Components for client-side auth operations
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
        }
    )
}

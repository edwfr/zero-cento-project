'use client'

import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider, NavigationLoadingProvider } from '@/components'
import { I18nProvider } from '@/lib/i18n/provider'

// Create a client instance for TanStack Query
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            refetchOnWindowFocus: true,
        },
    },
})

export function Providers({ children }: { children: ReactNode }) {
    return (
        <I18nProvider>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <NavigationLoadingProvider>{children}</NavigationLoadingProvider>
                </ToastProvider>
            </QueryClientProvider>
        </I18nProvider>
    )
}

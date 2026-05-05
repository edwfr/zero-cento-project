'use client'

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'
import NavigationLoadingOverlay from './NavigationLoadingOverlay'

interface NavigationLoadingContextValue {
    isLoading: boolean
    start: (label?: string) => void
    stop: () => void
}

const NavigationLoadingContext = createContext<NavigationLoadingContextValue | null>(null)

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false)
    const [label, setLabel] = useState<string | undefined>(undefined)

    const start = useCallback((nextLabel?: string) => {
        setLabel(nextLabel)
        setIsLoading(true)
    }, [])

    const stop = useCallback(() => {
        setIsLoading(false)
        setLabel(undefined)
    }, [])

    const value = useMemo(
        () => ({ isLoading, start, stop }),
        [isLoading, start, stop]
    )

    return (
        <NavigationLoadingContext.Provider value={value}>
            {children}
            {isLoading && <NavigationLoadingOverlay label={label} />}
        </NavigationLoadingContext.Provider>
    )
}

export function useNavigationLoader(): NavigationLoadingContextValue {
    const ctx = useContext(NavigationLoadingContext)
    if (!ctx) {
        throw new Error('useNavigationLoader must be used within NavigationLoadingProvider')
    }
    return ctx
}

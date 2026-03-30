'use client'

import { ReactNode, useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from './client'

interface I18nProviderWrapperProps {
    children: ReactNode
}

export function I18nProvider({ children }: I18nProviderWrapperProps) {
    const [isInitialized, setIsInitialized] = useState(false)

    useEffect(() => {
        // Ensure i18n is initialized
        if (i18n.isInitialized || i18n.isInitializing) {
            setIsInitialized(true)
        }
    }, [])

    if (!isInitialized) {
        return null
    }

    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
    I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/i18n/client', () => ({
    default: { isInitialized: true, isInitializing: false },
}))

import { I18nProvider } from '@/lib/i18n/provider'

describe('I18nProvider', () => {
    it('renders its children once i18n is initialized', () => {
        render(
            <I18nProvider>
                <span>contenuto</span>
            </I18nProvider>
        )

        expect(screen.getByText('contenuto')).toBeInTheDocument()
    })
})

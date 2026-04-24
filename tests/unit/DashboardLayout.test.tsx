import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardLayout from '@/components/DashboardLayout'

// next/navigation, next/link, @/lib/supabase-client, react-i18next
// are all mocked globally in tests/unit/setup.ts

vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => <img {...(props as object)} />,
}))

const mockUser = {
    id: '1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'trainer' as const,
}

describe('DashboardLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders children', () => {
        render(
            <DashboardLayout user={mockUser}>
                <div>Test Content</div>
            </DashboardLayout>
        )
        expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('renders back link with correct href when backHref is provided', () => {
        render(
            <DashboardLayout user={mockUser} backHref="/trainer/dashboard">
                <div>Test Content</div>
            </DashboardLayout>
        )
        const backLink = screen.getByTestId('back-nav-link')
        expect(backLink).toBeInTheDocument()
        expect(backLink).toHaveAttribute('href', '/trainer/dashboard')
    })

    it('does not render back link when backHref is not provided', () => {
        render(
            <DashboardLayout user={mockUser}>
                <div>Test Content</div>
            </DashboardLayout>
        )
        expect(screen.queryByTestId('back-nav-link')).not.toBeInTheDocument()
    })
})


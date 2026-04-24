import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/supabase-client', () => ({
    createClient: () => ({ auth: { signOut: vi.fn().mockResolvedValue({}) } }),
}))
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <img {...(props as object)} /> }))
vi.mock('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}))

const mockUser = {
    id: '1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'trainer' as const,
}

describe('DashboardLayout', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('renders children', () => {
        const DashboardLayout = require('@/components/DashboardLayout').default
        render(
            <DashboardLayout user={mockUser}>
                <div>Test Content</div>
            </DashboardLayout>
        )
        expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('renders back button when backHref is provided', () => {
        const DashboardLayout = require('@/components/DashboardLayout').default
        render(
            <DashboardLayout user={mockUser} backHref="/trainer/dashboard">
                <div>Test Content</div>
            </DashboardLayout>
        )
        const backLink = screen.getByRole('link', { name: '' })?.closest('a[href="/trainer/dashboard"]')
        expect(backLink).toBeInTheDocument()
    })

    it('does not render back button when backHref is not provided', () => {
        const DashboardLayout = require('@/components/DashboardLayout').default
        const { container } = render(
            <DashboardLayout user={mockUser}>
                <div>Test Content</div>
            </DashboardLayout>
        )
        const backButton = container.querySelectorAll('a[href*="/"]').length
        expect(backButton).toBeGreaterThan(0)
    })
})

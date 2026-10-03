import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SetPasswordPage from '@/app/onboarding/set-password/page'

const { authMock } = vi.hoisted(() => ({
    authMock: {
        verifyOtp: vi.fn(),
        setSession: vi.fn(),
        getUser: vi.fn(),
        updateUser: vi.fn(),
    },
}))

// The global supabase-client mock has no verifyOtp/getUser: this page needs both
vi.mock('@/lib/supabase-client', () => ({
    createClient: () => ({ auth: authMock }),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => <img {...(props as object)} />,
}))

const invitedUser = {
    id: 'user-1',
    app_metadata: { role: 'trainee', isActive: false },
    user_metadata: { firstName: 'Mario' },
}

const setUrl = (url: string) => window.history.replaceState(null, '', url)

describe('SetPasswordPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        setUrl('/')
    })

    it('waits for an explicit click before verifying a token_hash invite', async () => {
        setUrl('/onboarding/set-password?token_hash=abc123&type=invite')

        render(<SetPasswordPage />)

        expect(
            await screen.findByRole('button', { name: 'auth:setPassword.activateSubmit' }),
        ).toBeInTheDocument()
        expect(authMock.verifyOtp).not.toHaveBeenCalled()
        expect(authMock.getUser).not.toHaveBeenCalled()
    })

    it('verifies the token on click, cleans the URL and shows the password form', async () => {
        setUrl('/onboarding/set-password?token_hash=abc123&type=invite')
        authMock.verifyOtp.mockResolvedValue({ data: { user: invitedUser }, error: null })

        render(<SetPasswordPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'auth:setPassword.activateSubmit' }))

        expect(
            await screen.findByRole('button', { name: 'auth:setPassword.submit' }),
        ).toBeInTheDocument()
        expect(authMock.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'invite' })
        expect(window.location.search).toBe('')
    })

    it('shows the invalid invite message when the token is expired or already used', async () => {
        setUrl('/onboarding/set-password?token_hash=spent&type=invite')
        authMock.verifyOtp.mockResolvedValue({
            data: { user: null },
            error: { code: 'otp_expired', message: 'Email link is invalid or has expired' },
        })

        render(<SetPasswordPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'auth:setPassword.activateSubmit' }))

        expect(await screen.findByText('auth:setPassword.invalidInvite')).toBeInTheDocument()
        expect(
            screen.queryByRole('button', { name: 'auth:setPassword.activateSubmit' }),
        ).not.toBeInTheDocument()
    })

    it('shows the verify error when verifyOtp throws', async () => {
        setUrl('/onboarding/set-password?token_hash=abc123&type=invite')
        authMock.verifyOtp.mockRejectedValue(new Error('network down'))

        render(<SetPasswordPage />)
        fireEvent.click(await screen.findByRole('button', { name: 'auth:setPassword.activateSubmit' }))

        expect(await screen.findByText('auth:setPassword.verifyError')).toBeInTheDocument()
    })

    it('ignores a token_hash whose type is not invite and falls back to the session', async () => {
        setUrl('/onboarding/set-password?token_hash=abc123&type=recovery')
        authMock.getUser.mockResolvedValue({ data: { user: null }, error: null })

        render(<SetPasswordPage />)

        expect(await screen.findByText('auth:setPassword.invalidInvite')).toBeInTheDocument()
        expect(authMock.verifyOtp).not.toHaveBeenCalled()
    })

    it('keeps supporting legacy invite links with tokens in the URL hash', async () => {
        setUrl('/onboarding/set-password#access_token=at&refresh_token=rt')
        authMock.setSession.mockResolvedValue({ data: { user: invitedUser }, error: null })

        render(<SetPasswordPage />)

        await waitFor(() =>
            expect(authMock.setSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' }),
        )
        expect(
            await screen.findByRole('button', { name: 'auth:setPassword.submit' }),
        ).toBeInTheDocument()
    })
})

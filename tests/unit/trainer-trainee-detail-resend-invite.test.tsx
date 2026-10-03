import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('recharts', () => ({
    ResponsiveContainer: () => null,
    LineChart: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
}))

vi.mock('@/components/TraineePlannedMuscleGroupReport', () => ({
    default: () => <div data-testid="planned-muscle-report" />,
}))

const showToast = vi.fn()

vi.mock('@/components', async () => {
    const actual = await vi.importActual<typeof import('@/components')>('@/components')
    return {
        ...actual,
        useToast: () => ({ showToast }),
    }
})

import TraineeDetailContent from '@/app/trainer/trainees/[id]/_content'

function jsonResponse(body: unknown, ok = true) {
    return { ok, json: async () => body } as Response
}

function mockFetch(user: Record<string, unknown>, resendResponse = jsonResponse({ data: { status: 'invitation_sent' } })) {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/resend-invite')) return resendResponse
        if (/\/api\/users\/[^/?]+$/.test(url)) return jsonResponse({ data: { user } })
        return jsonResponse({ data: { items: [], points: [] } })
    }) as unknown as typeof fetch
}

const baseUser = {
    id: 'trainee-1',
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario.rossi@example.com',
    createdAt: '2026-01-01T00:00:00Z',
}

describe('TraineeDetailContent resend invite', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the pending badge and re-sends the invite on click', async () => {
        mockFetch({ ...baseUser, isActive: false, invitationPending: true, pendingActivation: true })
        render(<TraineeDetailContent />)

        expect(await screen.findByRole('button', { name: 'userStatus.pending' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /athletes.resendInvite/ }))

        await waitFor(() => expect(showToast).toHaveBeenCalledWith('athletes.resendInviteSuccess', 'success'))
        expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/users\/.+\/resend-invite$/), { method: 'POST' })
    })

    it('shows the API error when the re-send fails', async () => {
        mockFetch(
            { ...baseUser, isActive: false, invitationPending: true, pendingActivation: true },
            jsonResponse({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many', key: 'user.inviteRateLimited' } }, false),
        )
        render(<TraineeDetailContent />)

        fireEvent.click(await screen.findByRole('button', { name: /athletes.resendInvite/ }))

        await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error'))
    })

    it('hides the re-send button for a trainee who completed onboarding', async () => {
        mockFetch({ ...baseUser, isActive: true, invitationPending: false, pendingActivation: false })
        render(<TraineeDetailContent />)

        expect(await screen.findByRole('button', { name: 'userStatus.active' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /athletes.resendInvite/ })).not.toBeInTheDocument()
    })
})

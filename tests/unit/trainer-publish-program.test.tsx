import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

import PublishProgramPage from '@/app/trainer/programs/[id]/publish/_content'
import type { SubscriptionSummary } from '@/lib/subscriptions'

const program = {
    id: 'prog-1',
    title: 'Forza A',
    status: 'draft',
    trainee: { id: 't-1', firstName: 'Mario', lastName: 'Rossi' },
    durationWeeks: 1,
    workoutsPerWeek: 1,
    startDate: null,
    weeks: [{ weekNumber: 1, weekType: 'ipertrofia', workouts: [{ id: 'w1', dayIndex: 1, workoutExercises: [{ id: 'we1' }] }] }],
}

/** Program detail, then the trainee's subscription, then the publish call. */
function mockApi(current: SubscriptionSummary | null, subscriptionOk = true) {
    global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/subscription-renewals')) {
            return Promise.resolve({ ok: subscriptionOk, json: async () => ({ data: { current } }) })
        }
        return Promise.resolve({ ok: true, json: async () => ({ data: { program } }) })
    }) as never
}

const clickPublish = async () => fireEvent.click(await screen.findByRole('button', { name: 'publish.publishButton' }))

describe('PublishProgramPage — subscription coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows how the balance changes for a package trainee', async () => {
        mockApi({ kind: 'programs', status: 'active', remaining: 3 })
        render(<PublishProgramPage />)

        expect(await screen.findByTestId('publish-credit-info')).toHaveTextContent('publish.creditInfo')
    })

    it('shows no balance line for a period trainee', async () => {
        mockApi({ kind: 'period', status: 'active', endDate: '2026-12-01T00:00:00.000Z', daysLeft: 50 })
        render(<PublishProgramPage />)

        await screen.findByRole('button', { name: 'publish.publishButton' })
        expect(screen.queryByTestId('publish-credit-info')).not.toBeInTheDocument()
    })

    it.each([
        ['programsExhausted', { kind: 'programs', status: 'expired', remaining: 0 }],
        ['periodExpired', { kind: 'period', status: 'expired', endDate: '2026-09-01T00:00:00.000Z', daysLeft: -30 }],
        ['none', null],
    ] as const)('warns before publishing without coverage (%s)', async (reason, current) => {
        mockApi(current as SubscriptionSummary | null)
        render(<PublishProgramPage />)

        await clickPublish()

        expect(await screen.findByText(new RegExp(`publish\\.uncovered\\.${reason}`))).toBeInTheDocument()
    })

    it('uses the plain confirmation for a covered trainee', async () => {
        mockApi({ kind: 'programs', status: 'expiring', remaining: 1 })
        render(<PublishProgramPage />)

        await clickPublish()

        expect(await screen.findByText('publish.confirmMessage')).toBeInTheDocument()
        expect(screen.queryByText(/publish\.uncovered\./)).not.toBeInTheDocument()
    })

    it('does not block or warn when the subscription cannot be loaded', async () => {
        mockApi(null, false)
        render(<PublishProgramPage />)

        await clickPublish()

        expect(await screen.findByText('publish.confirmMessage')).toBeInTheDocument()
    })

    it('still publishes after the warning is confirmed', async () => {
        mockApi({ kind: 'programs', status: 'expired', remaining: 0 })
        render(<PublishProgramPage />)

        await clickPublish()
        fireEvent.click(await screen.findByRole('button', { name: /publish\.uncovered\.confirm/ }))

        await waitFor(() =>
            expect(
                vi.mocked(global.fetch).mock.calls.some(([url, init]) => String(url).endsWith('/publish') && init?.method === 'POST')
            ).toBe(true)
        )
    })
})

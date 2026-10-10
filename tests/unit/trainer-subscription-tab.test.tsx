import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const showToast = vi.fn()
vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
    ToastProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

import SubscriptionTab from '@/app/trainer/trainees/[id]/_subscription-tab'
import type { TraineeSubscriptionState } from '@/app/trainer/trainees/[id]/_use-trainee-subscription'

const TRAINEE_ID = 't-1'
const renewal = {
    id: 'r-1',
    traineeId: TRAINEE_ID,
    startDate: '2026-09-10T00:00:00.000Z',
    durationMonths: 1,
    endDate: '2026-10-10T00:00:00.000Z',
    createdAt: '2026-09-10T10:00:00.000Z',
}

function makeState(overrides: Partial<TraineeSubscriptionState> = {}): TraineeSubscriptionState {
    return {
        renewals: [renewal],
        current: { kind: 'period', status: 'expiring', endDate: renewal.endDate, daysLeft: 7 },
        loading: false,
        error: false,
        reload: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    }
}

function mockFetchOk() {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }) as never
}

describe('SubscriptionTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows one history row per renewal, without repeating the status card', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState()} />)

        // Status lives in the header icon and banner now
        expect(screen.queryByText('subscriptions.currentTitle')).not.toBeInTheDocument()
        const table = screen.getByRole('table', { name: 'subscriptions.historyTitle' })
        expect(within(table).getAllByRole('row')).toHaveLength(2) // header + 1
    })

    it('shows the empty state without renewals', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState({ renewals: [], current: null })} />)

        expect(screen.getByText('subscriptions.empty')).toBeInTheDocument()
        expect(screen.queryByText('subscriptions.badge.none')).not.toBeInTheDocument()
    })

    it('pre-fills a new renewal with the day after the current expiry', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState()} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))

        expect(screen.getByLabelText(/subscriptions\.startDate/)).toHaveValue('11/10/2026')
    })

    it('creates a renewal and reloads the shared state', async () => {
        mockFetchOk()
        const state = makeState()
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={state} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))
        fireEvent.change(screen.getByLabelText(/subscriptions\.duration/), { target: { value: '3' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(state.reload).toHaveBeenCalled())
        expect(global.fetch).toHaveBeenCalledWith(
            '/api/subscription-renewals',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ traineeId: TRAINEE_ID, startDate: '2026-10-11', durationMonths: 3 }),
            })
        )
    })

    it('deletes a renewal after confirmation and reloads', async () => {
        mockFetchOk()
        const state = makeState()
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={state} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.deleteAction' }))
        const dialog = await screen.findByRole('dialog')
        // ConfirmationModal labels its confirm button "<confirmText> - <title>"
        fireEvent.click(within(dialog).getByRole('button', { name: 'common:common.delete - subscriptions.deleteTitle' }))

        await waitFor(() => expect(state.reload).toHaveBeenCalled())
        expect(global.fetch).toHaveBeenCalledWith('/api/subscription-renewals/r-1', { method: 'DELETE' })
    })

    it('shows a toast when saving fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { code: 'X', message: 'boom' } }) }) as never
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState()} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))
        fireEvent.change(screen.getByLabelText(/subscriptions\.duration/), { target: { value: '3' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error'))
    })

    it('offers a retry on load error', () => {
        const state = makeState({ error: true })
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={state} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.retry' }))

        expect(state.reload).toHaveBeenCalled()
    })
})

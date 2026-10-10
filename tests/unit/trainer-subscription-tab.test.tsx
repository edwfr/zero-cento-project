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
    kind: 'period' as const,
    startDate: '2026-09-10T00:00:00.000Z',
    durationMonths: 1,
    endDate: '2026-10-10T00:00:00.000Z',
    programCount: null,
    createdAt: '2026-09-10T10:00:00.000Z',
}

const packageRow = {
    id: 'p-1',
    traineeId: TRAINEE_ID,
    kind: 'programs' as const,
    startDate: '2026-10-01T00:00:00.000Z',
    durationMonths: null,
    endDate: null,
    programCount: 5,
    createdAt: '2026-10-01T10:00:00.000Z',
}

function makeState(overrides: Partial<TraineeSubscriptionState> = {}): TraineeSubscriptionState {
    return {
        renewals: [renewal],
        current: { kind: 'period', status: 'expiring', endDate: renewal.endDate, daysLeft: 7 },
        events: [],
        programBalance: 0,
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
                body: JSON.stringify({ traineeId: TRAINEE_ID, kind: 'period', startDate: '2026-10-11', durationMonths: 3 }),
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

    it('shows packages and period renewals in one history table', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState({ renewals: [packageRow, renewal] })} />)

        const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
        expect(rows).toHaveLength(2)
        expect(within(rows[0]).getByText('subscriptions.kind.programs')).toBeInTheDocument()
        expect(within(rows[0]).getByText('subscriptions.programCountValue')).toBeInTheDocument()
        expect(within(rows[1]).getByText('subscriptions.kind.period')).toBeInTheDocument()
    })

    it('shows the program balance when the trainee has packages', () => {
        render(
            <SubscriptionTab
                traineeId={TRAINEE_ID}
                state={makeState({
                    renewals: [packageRow],
                    current: { kind: 'programs', status: 'active', remaining: 3 },
                    programBalance: 3,
                })}
            />
        )

        expect(screen.getByTestId('program-balance')).toHaveTextContent('subscriptions.programs.available')
    })

    it('hides the program balance for a trainee who never bought a package', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState()} />)

        expect(screen.queryByTestId('program-balance')).not.toBeInTheDocument()
    })

    it('opens a new renewal on the programs form for a package trainee', () => {
        render(
            <SubscriptionTab
                traineeId={TRAINEE_ID}
                state={makeState({ renewals: [packageRow], current: { kind: 'programs', status: 'expired', remaining: 0 } })}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))

        expect(screen.getByLabelText(/subscriptions\.programCount/)).toBeInTheDocument()
    })

    it('sends the package payload when saving', async () => {
        mockFetchOk()
        const state = makeState({ renewals: [packageRow], current: { kind: 'programs', status: 'expired', remaining: 0 } })
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={state} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.addButton' }))
        fireEvent.change(screen.getByLabelText(/subscriptions\.programCount/), { target: { value: '3' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(state.reload).toHaveBeenCalled())
        const [, init] = vi.mocked(global.fetch).mock.calls[0]
        expect(JSON.parse(String(init?.body))).toMatchObject({ traineeId: TRAINEE_ID, kind: 'programs', programCount: 3 })
    })

    it('lists the movements below the history', () => {
        render(
            <SubscriptionTab
                traineeId={TRAINEE_ID}
                state={makeState({
                    events: [
                        {
                            id: 'e1',
                            type: 'package_created',
                            creditDelta: 5,
                            details: { programCount: 5 },
                            createdAt: '2026-10-01T10:00:00.000Z',
                            actorName: 'Marco Trainer',
                        },
                    ],
                })}
            />
        )

        expect(screen.getByText('subscriptions.events.title')).toBeInTheDocument()
        expect(screen.getByText('subscriptions.events.types.package_created')).toBeInTheDocument()
    })

    it('asks to confirm a package deletion with its own message', () => {
        render(<SubscriptionTab traineeId={TRAINEE_ID} state={makeState({ renewals: [packageRow] })} />)

        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.deleteAction' }))

        expect(screen.getByText('subscriptions.deletePackageMessage')).toBeInTheDocument()
    })
})

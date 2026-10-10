import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const showToast = vi.hoisted(() => vi.fn())

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
}))

import MacroPhaseTypesSection from '@/components/MacroPhaseTypesSection'
import { PHASE_COLOR_PALETTE, type MacroPhaseTypeDto } from '@/lib/macro-periods'

const phase = (overrides: Partial<MacroPhaseTypeDto>): MacroPhaseTypeDto => ({
    id: 'p1',
    name: 'Forza',
    description: null,
    color: PHASE_COLOR_PALETTE[0],
    sortOrder: 0,
    isActive: true,
    usageCount: 0,
    ...overrides,
})

const PHASES: MacroPhaseTypeDto[] = [
    phase({ id: 'p1', name: 'Forza', description: 'Carichi alti', sortOrder: 0, usageCount: 2 }),
    phase({ id: 'p2', name: 'Scarico', color: PHASE_COLOR_PALETTE[1], sortOrder: 3 }),
    phase({ id: 'p3', name: 'Vecchia', color: '#000000', sortOrder: 5, isActive: false, usageCount: 1 }),
]

type Call = { url: string; method: string; body: unknown }

/** GET returns the list; every write is recorded and answered by `onWrite` (default: success). */
function mockApi(onWrite: (call: Call) => { status: number; json: unknown } = () => ({ status: 200, json: { data: {} } })) {
    const calls: Call[] = []
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        if (method === 'GET') {
            return { ok: true, status: 200, json: async () => ({ data: { items: PHASES } }) } as Response
        }
        const call = { url: String(input), method, body: init?.body ? JSON.parse(String(init.body)) : undefined }
        calls.push(call)
        const { status, json } = onWrite(call)
        return { ok: status < 400, status, json: async () => json } as Response
    })
    return calls
}

const row = async (name: string) => screen.findByRole('listitem', { name })

describe('MacroPhaseTypesSection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('lists the phases with meaning and archived state', async () => {
        mockApi()
        render(<MacroPhaseTypesSection />)

        expect(within(await row('Forza')).getByText('Carichi alti')).toBeInTheDocument()
        expect(within(await row('Vecchia')).getByText('macroPhases.archived')).toBeInTheDocument()
        expect(within(await row('Scarico')).queryByText('macroPhases.archived')).not.toBeInTheDocument()
    })

    it('offers delete only for an unused phase and archive only for a used one', async () => {
        mockApi()
        render(<MacroPhaseTypesSection />)

        const used = within(await row('Forza'))
        expect(used.getByRole('button', { name: 'macroPhases.archive' })).toBeInTheDocument()
        expect(used.queryByRole('button', { name: 'macroPhases.delete' })).not.toBeInTheDocument()

        const unused = within(await row('Scarico'))
        expect(unused.getByRole('button', { name: 'macroPhases.delete' })).toBeInTheDocument()
        expect(unused.queryByRole('button', { name: 'macroPhases.archive' })).not.toBeInTheDocument()

        expect(within(await row('Vecchia')).getByRole('button', { name: 'macroPhases.reactivate' })).toBeInTheDocument()
    })

    it('creates a phase with the first palette colour not in use', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)
        await row('Forza')

        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.add' }))
        fireEvent.change(screen.getByLabelText(/macroPhases\.name/), { target: { value: '  Ipertrofia ' } })
        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.create' }))

        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({
            url: '/api/macro-phase-types',
            method: 'POST',
            body: { name: 'Ipertrofia', description: null, color: PHASE_COLOR_PALETTE[2] },
        })
    })

    it('keeps the create button disabled while the name is empty', async () => {
        mockApi()
        render(<MacroPhaseTypesSection />)
        await row('Forza')

        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.add' }))

        expect(screen.getByRole('button', { name: 'macroPhases.create' })).toBeDisabled()
    })

    it('saves an edited name, meaning and colour', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)

        fireEvent.click(within(await row('Scarico')).getByRole('button', { name: 'macroPhases.edit' }))
        fireEvent.change(screen.getByLabelText(/macroPhases\.name/), { target: { value: 'Deload' } })
        fireEvent.change(screen.getByLabelText('macroPhases.descriptionLabel'), { target: { value: 'Recupero' } })
        fireEvent.click(screen.getByRole('button', { name: PHASE_COLOR_PALETTE[4] }))
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({
            url: '/api/macro-phase-types/p2',
            method: 'PATCH',
            body: { name: 'Deload', description: 'Recupero', color: PHASE_COLOR_PALETTE[4] },
        })
    })

    it('archives a used phase and reactivates an archived one', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)

        fireEvent.click(within(await row('Forza')).getByRole('button', { name: 'macroPhases.archive' }))
        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({ url: '/api/macro-phase-types/p1', method: 'PATCH', body: { isActive: false } })

        // buttons are disabled while the first write and its reload are in flight
        const reactivate = within(await row('Vecchia')).getByRole('button', { name: 'macroPhases.reactivate' })
        await waitFor(() => expect(reactivate).toBeEnabled())
        fireEvent.click(reactivate)
        await waitFor(() => expect(calls).toHaveLength(2))
        expect(calls[1]).toEqual({ url: '/api/macro-phase-types/p3', method: 'PATCH', body: { isActive: true } })
    })

    it('reorders by swapping the sort order of two neighbours', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)

        fireEvent.click(within(await row('Forza')).getByRole('button', { name: 'macroPhases.moveDown' }))

        await waitFor(() => expect(calls).toHaveLength(2))
        expect(calls).toEqual([
            { url: '/api/macro-phase-types/p1', method: 'PATCH', body: { sortOrder: 3 } },
            { url: '/api/macro-phase-types/p2', method: 'PATCH', body: { sortOrder: 0 } },
        ])
    })

    it('disables moving the first phase up and the last one down', async () => {
        mockApi()
        render(<MacroPhaseTypesSection />)

        expect(within(await row('Forza')).getByRole('button', { name: 'macroPhases.moveUp' })).toBeDisabled()
        expect(within(await row('Vecchia')).getByRole('button', { name: 'macroPhases.moveDown' })).toBeDisabled()
    })

    it('deletes an unused phase after confirmation', async () => {
        const calls = mockApi()
        render(<MacroPhaseTypesSection />)

        fireEvent.click(within(await row('Scarico')).getByRole('button', { name: 'macroPhases.delete' }))
        fireEvent.click(screen.getByRole('button', { name: /^macroPhases\.deleteConfirm -/ }))

        await waitFor(() => expect(calls).toHaveLength(1))
        expect(calls[0]).toEqual({ url: '/api/macro-phase-types/p2', method: 'DELETE', body: undefined })
    })

    it('shows the translated API error and keeps the form open', async () => {
        mockApi(() => ({ status: 409, json: { error: { code: 'CONFLICT', message: 'x', key: 'macroPhase.nameExists' } } }))
        render(<MacroPhaseTypesSection />)
        await row('Forza')

        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.add' }))
        fireEvent.change(screen.getByLabelText(/macroPhases\.name/), { target: { value: 'Forza' } })
        fireEvent.click(screen.getByRole('button', { name: 'macroPhases.create' }))

        await waitFor(() => expect(showToast).toHaveBeenCalledWith('errors:macroPhase.nameExists', 'error'))
        expect(screen.getByRole('button', { name: 'macroPhases.create' })).toBeInTheDocument()
    })

    it('shows an error with a retry when the list cannot be loaded', async () => {
        global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: {} }) }) as Response)
        render(<MacroPhaseTypesSection />)

        expect(await screen.findByText('macroPhases.loadError')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'common:common.retry' })).toBeInTheDocument()
    })
})

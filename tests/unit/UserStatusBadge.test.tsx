import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import UserStatusBadge from '@/components/UserStatusBadge'

const history = {
    createdAt: '2026-10-01T09:12:05.000Z',
    isActive: true,
    events: [
        { type: 'created', at: '2026-10-01T09:12:05.000Z', actor: { firstName: 'Luca', lastName: 'Bianchi' } },
        { type: 'activated', at: '2026-10-01T18:40:11.000Z', actor: { firstName: 'Mario', lastName: 'Rossi' } },
    ],
}

function mockFetchOk(body: unknown = history) {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: body }) }) as Response)
    global.fetch = fetchMock as unknown as typeof fetch
    return fetchMock
}

describe('UserStatusBadge', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it.each([
        [{ isActive: true, pendingActivation: false }, 'userStatus.active'],
        [{ isActive: false, pendingActivation: false }, 'userStatus.deactivated'],
        [{ isActive: false, pendingActivation: true }, 'userStatus.pending'],
    ])('renders the label for %o', (props, label) => {
        mockFetchOk()
        render(<UserStatusBadge userId="u-1" {...props} />)

        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    })

    it('opens on hover, loads the history once and shows dates and authors', async () => {
        const fetchMock = mockFetchOk()
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)
        const badge = screen.getByRole('button', { name: 'userStatus.active' })

        fireEvent.mouseEnter(badge)

        expect(await screen.findByText('userStatus.kind.created')).toBeInTheDocument()
        expect(screen.getByText('userStatus.kind.activated')).toBeInTheDocument()
        expect(screen.getByText(/01\/10\/2026 09:12:05/)).toBeInTheDocument()
        expect(screen.getByText(/Luca Bianchi/)).toBeInTheDocument()
        expect(screen.getByText(/Mario Rossi/)).toBeInTheDocument()
        expect(badge).toHaveAttribute('aria-expanded', 'true')

        fireEvent.mouseLeave(badge)
        fireEvent.mouseEnter(badge)
        fireEvent.mouseLeave(badge)
        fireEvent.click(badge)

        await screen.findByText('userStatus.kind.created')
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith('/api/users/u-1/status-history', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    })

    it('shows no author when the step has none', async () => {
        mockFetchOk({ ...history, events: [{ type: 'created', at: history.createdAt, actor: null }] })
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)

        fireEvent.click(screen.getByRole('button', { name: 'userStatus.active' }))

        await screen.findByText('userStatus.kind.created')
        expect(screen.queryByText(/userStatus\.by/)).not.toBeInTheDocument()
    })

    it('shows an error when the history cannot be loaded', async () => {
        global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ error: {} }) }) as Response) as unknown as typeof fetch
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)

        fireEvent.click(screen.getByRole('button', { name: 'userStatus.active' }))

        expect(await screen.findByText('userStatus.loadError')).toBeInTheDocument()
    })

    it('closes on Escape and on an outside click', async () => {
        mockFetchOk()
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)
        const badge = screen.getByRole('button', { name: 'userStatus.active' })

        fireEvent.click(badge)
        await screen.findByRole('tooltip')
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

        fireEvent.click(badge)
        await screen.findByRole('tooltip')
        fireEvent.mouseDown(document.body)
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('reloads the history after a status change', async () => {
        const fetchMock = mockFetchOk()
        const { rerender } = render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)

        fireEvent.click(screen.getByRole('button', { name: 'userStatus.active' }))
        await screen.findByText('userStatus.kind.created')
        fireEvent.keyDown(document, { key: 'Escape' })

        rerender(<UserStatusBadge userId="u-1" isActive={false} pendingActivation={false} />)
        fireEvent.click(screen.getByRole('button', { name: 'userStatus.deactivated' }))

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    })

    it('opens above the badge when there is no room below', async () => {
        mockFetchOk()
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(200)
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)
        const badge = screen.getByRole('button', { name: 'userStatus.active' })
        vi.spyOn(badge, 'getBoundingClientRect').mockReturnValue({
            top: window.innerHeight - 40,
            bottom: window.innerHeight - 10,
            left: window.innerWidth - 20,
            right: window.innerWidth,
            width: 20,
            height: 30,
            x: window.innerWidth - 20,
            y: window.innerHeight - 40,
            toJSON: () => ({}),
        })

        await act(async () => {
            fireEvent.click(badge)
        })
        const tooltip = await screen.findByRole('tooltip')

        expect(parseFloat(tooltip.style.top)).toBe(window.innerHeight - 40 - 8 - 200)
        expect(parseFloat(tooltip.style.left) + parseFloat(tooltip.style.width)).toBeLessThanOrEqual(window.innerWidth - 8)
    })

    it('stays open while the pointer moves from the badge onto the popover', async () => {
        mockFetchOk()
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)
        const badge = screen.getByRole('button', { name: 'userStatus.active' })

        fireEvent.mouseEnter(badge)
        const tooltip = await screen.findByRole('tooltip')
        fireEvent.mouseLeave(badge, { relatedTarget: tooltip })
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        fireEvent.mouseDown(tooltip)
        expect(screen.getByRole('tooltip')).toBeInTheDocument()

        fireEvent.mouseLeave(tooltip, { relatedTarget: document.body })
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('caps the height and scrolls when the timeline fits neither below nor above', async () => {
        mockFetchOk()
        vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(5000)
        render(<UserStatusBadge userId="u-1" isActive pendingActivation={false} />)
        const badge = screen.getByRole('button', { name: 'userStatus.active' })
        vi.spyOn(badge, 'getBoundingClientRect').mockReturnValue({
            top: 100,
            bottom: 130,
            left: 10,
            right: 60,
            width: 50,
            height: 30,
            x: 10,
            y: 100,
            toJSON: () => ({}),
        })

        await act(async () => {
            fireEvent.click(badge)
        })
        const tooltip = await screen.findByRole('tooltip')

        // More room below (viewport 768 in jsdom): open below, capped to the free space
        expect(parseFloat(tooltip.style.top)).toBe(130 + 8)
        expect(parseFloat(tooltip.style.maxHeight)).toBe(window.innerHeight - 130 - 2 * 8)
        expect(tooltip.style.overflowY).toBe('auto')
    })
})

import { describe, it, expect } from 'vitest'
import { buildStatusTimeline, type StatusHistoryEvent } from '@/lib/user-status-timeline'

const trainer = { firstName: 'Luca', lastName: 'Bianchi' }
const trainee = { firstName: 'Mario', lastName: 'Rossi' }
const CREATED_AT = '2026-10-01T09:00:00.000Z'

const event = (type: StatusHistoryEvent['type'], at: string, actor: StatusHistoryEvent['actor']): StatusHistoryEvent => ({
    type,
    at,
    actor,
})

describe('buildStatusTimeline', () => {
    it('shows a fresh trainee as created and waiting for activation', () => {
        expect(
            buildStatusTimeline({ createdAt: CREATED_AT, isActive: false, events: [event('created', CREATED_AT, trainer)] })
        ).toEqual([
            { kind: 'created', at: CREATED_AT, actorName: 'Luca Bianchi' },
            { kind: 'pending_activation', at: null, actorName: null },
        ])
    })

    it('lists re-sent invitations before the pending line', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: false,
            events: [event('created', CREATED_AT, trainer), event('invitation_resent', '2026-10-02T10:00:00.000Z', trainer)],
        })

        expect(lines.map((line) => line.kind)).toEqual(['created', 'invitation_resent', 'pending_activation'])
    })

    it('shows the activation authored by the trainee', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: true,
            events: [event('created', CREATED_AT, trainer), event('activated', '2026-10-01T18:00:00.000Z', trainee)],
        })

        expect(lines).toEqual([
            { kind: 'created', at: CREATED_AT, actorName: 'Luca Bianchi' },
            { kind: 'activated', at: '2026-10-01T18:00:00.000Z', actorName: 'Mario Rossi' },
        ])
    })

    it('keeps every deactivate / reactivate cycle in order', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: false,
            events: [
                event('created', CREATED_AT, trainer),
                event('activated', '2026-10-01T18:00:00.000Z', trainee),
                event('deactivated', '2026-10-05T08:00:00.000Z', trainer),
                event('reactivated', '2026-10-06T08:00:00.000Z', trainer),
                event('deactivated', '2026-10-07T08:00:00.000Z', trainer),
            ],
        })

        expect(lines.map((line) => line.kind)).toEqual(['created', 'activated', 'deactivated', 'reactivated', 'deactivated'])
    })

    it('adds an undated deactivation for legacy users deactivated before the history existed', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: false,
            events: [event('created', CREATED_AT, trainer), event('activated', '2026-10-01T18:00:00.000Z', trainee)],
        })

        expect(lines.at(-1)).toEqual({ kind: 'deactivated', at: null, actorName: null })
    })

    it('falls back to createdAt without author when there is no created event', () => {
        const lines = buildStatusTimeline({ createdAt: CREATED_AT, isActive: false, events: [] })

        expect(lines).toEqual([
            { kind: 'created', at: CREATED_AT, actorName: null },
            { kind: 'pending_activation', at: null, actorName: null },
        ])
    })

    it('shows no author when the actor was deleted', () => {
        const lines = buildStatusTimeline({
            createdAt: CREATED_AT,
            isActive: false,
            events: [event('created', CREATED_AT, null)],
        })

        expect(lines[0]).toEqual({ kind: 'created', at: CREATED_AT, actorName: null })
    })
})

export type StatusEventType = 'created' | 'activated' | 'deactivated' | 'reactivated' | 'invitation_resent'

export interface StatusHistoryEvent {
    type: StatusEventType
    at: string
    actor: { firstName: string; lastName: string } | null
}

/** Shape returned by GET /api/users/[id]/status-history */
export interface StatusHistory {
    createdAt: string
    isActive: boolean
    events: StatusHistoryEvent[]
}

export type TimelineKind = StatusEventType | 'pending_activation'

export interface TimelineLine {
    kind: TimelineKind
    /** null when the step has no date: still pending, or older than the history */
    at: string | null
    actorName: string | null
}

const toActorName = (actor: StatusHistoryEvent['actor']): string | null =>
    actor ? `${actor.firstName} ${actor.lastName}` : null

export function buildStatusTimeline({ createdAt, isActive, events }: StatusHistory): TimelineLine[] {
    // Users created by the old code during the deploy have no "created" event
    const created = events.find((event) => event.type === 'created')
    const lines: TimelineLine[] = [
        { kind: 'created', at: created?.at ?? createdAt, actorName: toActorName(created?.actor ?? null) },
    ]

    for (const event of events) {
        if (event.type === 'created') continue
        lines.push({ kind: event.type, at: event.at, actorName: toActorName(event.actor) })
    }

    if (isActive) return lines

    if (!events.some((event) => event.type === 'activated')) {
        lines.push({ kind: 'pending_activation', at: null, actorName: null })
    } else if (events.at(-1)?.type !== 'deactivated') {
        // Deactivated before the history existed: the date is unknown
        lines.push({ kind: 'deactivated', at: null, actorName: null })
    }

    return lines
}

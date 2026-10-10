'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RenewalRow, SubscriptionEventRow, SubscriptionSummary } from '@/lib/subscriptions'

export interface TraineeSubscriptionState {
    renewals: RenewalRow[]
    current: SubscriptionSummary | null
    /** Movement history, newest first */
    events: SubscriptionEventRow[]
    /** Programs available across every package, whatever the current mode (negative = owed) */
    programBalance: number
    loading: boolean
    error: boolean
    reload: () => Promise<void>
}

/**
 * Loaded once by the trainee page and shared by the banner (visible on every
 * tab) and the subscription tab, so a saved renewal updates both at once.
 */
export function useTraineeSubscription(traineeId: string): TraineeSubscriptionState {
    const [renewals, setRenewals] = useState<RenewalRow[]>([])
    const [current, setCurrent] = useState<SubscriptionSummary | null>(null)
    const [events, setEvents] = useState<SubscriptionEventRow[]>([])
    const [programBalance, setProgramBalance] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const reload = useCallback(async () => {
        try {
            setError(false)
            const res = await fetch(`/api/subscription-renewals?traineeId=${traineeId}`)
            if (!res.ok) throw new Error('load failed')
            const data = await res.json()
            setRenewals(data.data?.items ?? [])
            setCurrent(data.data?.current ?? null)
            setEvents(data.data?.events ?? [])
            setProgramBalance(data.data?.programBalance ?? 0)
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [traineeId])

    useEffect(() => {
        void reload()
    }, [reload])

    return { renewals, current, events, programBalance, loading, error, reload }
}

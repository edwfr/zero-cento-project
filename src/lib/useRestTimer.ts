import { useState, useRef, useCallback, useEffect } from 'react'

interface UseRestTimerOptions {
    onExpire: () => void
}

export interface UseRestTimerReturn {
    secondsLeft: number | null
    totalSeconds: number
    isRunning: boolean
    start: (restTimeSeconds: number) => void
    stop: () => void
}

export function useRestTimer({ onExpire }: UseRestTimerOptions): UseRestTimerReturn {
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
    const [totalSeconds, setTotalSeconds] = useState(0)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const clearDoneRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const remainingRef = useRef<number | null>(null)
    const onExpireRef = useRef(onExpire)
    onExpireRef.current = onExpire

    const clearTimers = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
        if (clearDoneRef.current !== null) {
            clearTimeout(clearDoneRef.current)
            clearDoneRef.current = null
        }
    }, [])

    const stop = useCallback(() => {
        clearTimers()
        remainingRef.current = null
        setSecondsLeft(null)
    }, [clearTimers])

    const start = useCallback((restTimeSeconds: number) => {
        clearTimers()

        const safeSeconds = Math.max(0, Math.floor(restTimeSeconds))
        remainingRef.current = safeSeconds
        setTotalSeconds(safeSeconds)
        setSecondsLeft(safeSeconds)

        if (safeSeconds <= 0) {
            onExpireRef.current()
            clearDoneRef.current = setTimeout(() => {
                remainingRef.current = null
                setSecondsLeft(null)
            }, 500)
            return
        }

        intervalRef.current = setInterval(() => {
            const current = remainingRef.current
            if (current === null) {
                return
            }

            if (current <= 1) {
                remainingRef.current = 0
                setSecondsLeft(0)

                if (intervalRef.current !== null) {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }

                onExpireRef.current()
                clearDoneRef.current = setTimeout(() => {
                    remainingRef.current = null
                    setSecondsLeft(null)
                }, 500)
                return
            }

            const nextValue = current - 1
            remainingRef.current = nextValue
            setSecondsLeft(nextValue)
        }, 1000)
    }, [clearTimers])

    useEffect(() => {
        return () => {
            clearTimers()
        }
    }, [clearTimers])

    return {
        secondsLeft,
        totalSeconds,
        isRunning: secondsLeft !== null && secondsLeft > 0,
        start,
        stop,
    }
}

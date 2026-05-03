'use client'

import { Check, Timer, X } from 'lucide-react'

interface FloatingRestTimerProps {
    secondsLeft: number | null
    totalSeconds: number
    onStop: () => void
    mode?: 'floating' | 'dock'
}

function formatCountdown(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export default function FloatingRestTimer({
    secondsLeft,
    totalSeconds,
    onStop,
    mode = 'floating',
}: FloatingRestTimerProps) {
    if (secondsLeft === null && mode === 'floating') {
        return null
    }

    const isDone = secondsLeft === 0
    const countdownSeconds = typeof secondsLeft === 'number' ? secondsLeft : 0
    const progress = totalSeconds > 0 && typeof secondsLeft === 'number' ? (secondsLeft / totalSeconds) * 100 : 0
    const safeProgress = Math.max(0, Math.min(progress, 100))
    const hasActiveCountdown = typeof secondsLeft === 'number'
    const isUrgent = hasActiveCountdown && !isDone && secondsLeft <= 5
    const isWarning = hasActiveCountdown && !isDone && secondsLeft <= 10 && !isUrgent

    if (mode === 'dock') {
        return (
            <div className="relative flex justify-center">
                <button
                    type="button"
                    onClick={() => {
                        if (hasActiveCountdown) {
                            onStop()
                        }
                    }}
                    aria-label={hasActiveCountdown ? 'Stop timer' : 'Timer'}
                    className={`rounded-full p-2 transition-colors ${
                        hasActiveCountdown
                            ? isUrgent
                                ? 'text-red-600 hover:bg-red-50'
                                : isWarning
                                    ? 'text-amber-600 hover:bg-amber-50'
                                    : 'text-brand-primary hover:bg-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-brand-primary'
                    }`}
                >
                    <Timer className="h-4 w-4" />
                </button>
                {hasActiveCountdown && (
                    <span
                        data-testid="floating-rest-timer-countdown"
                        className={`pointer-events-none absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white ${
                            isDone
                                ? 'bg-green-500'
                                : isUrgent
                                    ? 'bg-red-500'
                                    : isWarning
                                        ? 'bg-amber-500'
                                        : 'bg-brand-primary'
                        }`}
                        title={`${Math.round(safeProgress)}%`}
                    >
                        {formatCountdown(secondsLeft)}
                    </span>
                )}
            </div>
        )
    }

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center pb-[env(safe-area-inset-bottom)]">
            <div
                className={`pointer-events-auto relative min-w-[220px] overflow-hidden rounded-full border bg-white/95 px-4 py-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/90 ${
                    isDone
                        ? 'border-green-300 text-green-600'
                        : isUrgent
                            ? 'border-red-300 text-red-600'
                            : isWarning
                                ? 'border-amber-300 text-amber-600'
                                : 'border-gray-200 text-gray-700'
                }`}
            >
                <div className="flex items-center gap-3">
                    {isDone ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <Timer className="h-4 w-4 flex-shrink-0" />
                    )}

                    <span
                        data-testid="floating-rest-timer-countdown"
                        className="min-w-[2.8rem] text-center text-sm font-bold tabular-nums"
                    >
                        {isDone ? '0:00' : formatCountdown(countdownSeconds)}
                    </span>

                    {!isDone && (
                        <button
                            type="button"
                            onClick={onStop}
                            aria-label="Stop timer"
                            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-current transition-colors hover:bg-gray-100"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gray-100">
                    <div
                        className={`h-full transition-[width] duration-1000 ${
                            isDone
                                ? 'bg-green-500'
                                : isUrgent
                                    ? 'bg-red-500'
                                    : isWarning
                                        ? 'bg-amber-500'
                                        : 'bg-brand-primary'
                        }`}
                        style={{ width: `${safeProgress}%` }}
                    />
                </div>
            </div>
        </div>
    )
}

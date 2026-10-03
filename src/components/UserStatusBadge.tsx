'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Ban, CheckCircle2, Hourglass, MailPlus, RotateCcw, UserPlus, type LucideIcon } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'
import { formatDateTime } from '@/lib/date-format'
import { buildStatusTimeline, type StatusHistory, type TimelineKind } from '@/lib/user-status-timeline'

interface UserStatusBadgeProps {
    userId: string
    isActive: boolean
    pendingActivation: boolean
    size?: 'sm' | 'md'
}

const POPOVER_WIDTH = 288
const POPOVER_GAP = 8

const KIND_ICONS: Record<TimelineKind, LucideIcon> = {
    created: UserPlus,
    invitation_resent: MailPlus,
    pending_activation: Hourglass,
    activated: CheckCircle2,
    deactivated: Ban,
    reactivated: RotateCcw,
}

const STATUS_STYLES = {
    active: 'bg-green-100 text-green-800',
    deactivated: 'bg-red-100 text-red-800',
    pending: 'bg-amber-100 text-amber-800',
}

const SIZE_STYLES = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
}

/**
 * Account status badge. Hover, focus or tap opens the account timeline,
 * fetched on first open and cached until the status changes.
 */
export default function UserStatusBadge({ userId, isActive, pendingActivation, size = 'md' }: UserStatusBadgeProps) {
    const { t } = useTranslation('components')
    const [open, setOpen] = useState(false)
    const [history, setHistory] = useState<StatusHistory | null>(null)
    const [error, setError] = useState(false)
    const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({})
    const buttonRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const requestRef = useRef<AbortController | null>(null)

    // A status change (e.g. the list toggle) makes the cached history stale
    useEffect(() => {
        requestRef.current?.abort()
        requestRef.current = null
        setHistory(null)
        setError(false)
    }, [userId, isActive, pendingActivation])

    useEffect(() => () => requestRef.current?.abort(), [])

    const loadHistory = useCallback(async () => {
        if (requestRef.current) return
        const controller = new AbortController()
        requestRef.current = controller
        try {
            const res = await fetch(`/api/users/${userId}/status-history`, { signal: controller.signal })
            const json = await res.json()
            if (!res.ok) throw new Error('status history request failed')
            if (!controller.signal.aborted) setHistory(json.data)
        } catch {
            if (!controller.signal.aborted) setError(true)
        } finally {
            if (requestRef.current === controller) requestRef.current = null
        }
    }, [userId])

    useEffect(() => {
        if (open && !history && !error) void loadHistory()
    }, [open, history, error, loadHistory])

    // Fixed position in a portal: list rows sit in an overflow-hidden card
    const updatePosition = useCallback(() => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (!rect) return
        const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * POPOVER_GAP)
        const height = popoverRef.current?.offsetHeight ?? 0
        const left = Math.min(Math.max(POPOVER_GAP, rect.left), window.innerWidth - width - POPOVER_GAP)
        const fitsBelow = rect.bottom + POPOVER_GAP + height <= window.innerHeight
        setPopoverStyle({
            position: 'fixed',
            top: fitsBelow ? rect.bottom + POPOVER_GAP : Math.max(POPOVER_GAP, rect.top - POPOVER_GAP - height),
            left,
            width,
            zIndex: 9999,
        })
    }, [])

    useLayoutEffect(() => {
        if (!open) return
        updatePosition()
        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('resize', updatePosition)
        return () => {
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    }, [open, history, error, updatePosition])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        const onMouseDown = (event: MouseEvent) => {
            if (!buttonRef.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('mousedown', onMouseDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('mousedown', onMouseDown)
        }
    }, [open])

    const status = pendingActivation ? 'pending' : isActive ? 'active' : 'deactivated'
    const popoverId = `user-status-history-${userId}`

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`${SIZE_STYLES[size]} ${STATUS_STYLES[status]} font-semibold rounded-full cursor-help`}
                aria-expanded={open}
                aria-describedby={open ? popoverId : undefined}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                // Touch has no hover: a tap opens, a tap outside closes
                onClick={() => setOpen(true)}
            >
                {t(`userStatus.${status}`)}
            </button>
            {open &&
                createPortal(
                    <div
                        ref={popoverRef}
                        id={popoverId}
                        role="tooltip"
                        style={popoverStyle}
                        className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left"
                    >
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            {t('userStatus.historyTitle')}
                        </p>
                        {error ? (
                            <p className="text-sm text-state-error">{t('userStatus.loadError')}</p>
                        ) : !history ? (
                            <div className="flex justify-center py-2">
                                <LoadingSpinner size="sm" />
                            </div>
                        ) : (
                            <ol className="space-y-2">
                                {buildStatusTimeline(history).map((line, index) => {
                                    const Icon = KIND_ICONS[line.kind]
                                    return (
                                        <li key={index} className="flex gap-2 text-sm">
                                            <Icon size={16} className="mt-0.5 shrink-0 text-gray-500" aria-hidden="true" />
                                            <div>
                                                <p className="font-medium text-gray-900">{t(`userStatus.kind.${line.kind}`)}</p>
                                                {line.kind !== 'pending_activation' && (
                                                    <p className="text-xs text-gray-600">
                                                        {line.at ? formatDateTime(line.at, 'seconds') : t('userStatus.dateUnavailable')}
                                                        {line.actorName && ` · ${t('userStatus.by')} ${line.actorName}`}
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>
                        )}
                    </div>,
                    document.body
                )}
        </>
    )
}

'use client'

import Image from 'next/image'
import { useTranslation } from 'react-i18next'

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    color?: 'primary' | 'white' | 'gray'
    className?: string
    label?: string
}

/**
 * LoadingSpinner Component
 * Animated spinner usando i colori Zero Cento
 */
export default function LoadingSpinner({
    size = 'md',
    color = 'primary',
    className = '',
    label,
}: LoadingSpinnerProps) {
    const { t } = useTranslation('common')
    const sizeClasses = {
        sm: 'h-4 w-4 border-2',
        md: 'h-8 w-8 border-2',
        lg: 'h-12 w-12 border-4',
        xl: 'h-16 w-16 border-4',
    }

    const colorClasses = {
        primary: 'border-brand-primary/30 border-t-brand-primary',
        white: 'border-white/30 border-t-white',
        gray: 'border-gray-300 border-t-gray-700',
    }

    return (
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
            <div
                className={`
                    animate-spin rounded-full
                    ${sizeClasses[size]}
                    ${colorClasses[color]}
                `}
                role="status"
                aria-label={label || t('common.loading')}
            ></div>
            {label && (
                <span
                    className={`
                        text-sm font-medium
                        ${color === 'primary' ? 'text-gray-700' : ''}
                        ${color === 'white' ? 'text-white' : ''}
                        ${color === 'gray' ? 'text-gray-600' : ''}
                    `}
                >
                    {label}
                </span>
            )}
        </div>
    )
}

/**
 * FullPageLoader Component
 * Full-screen loading overlay con spinner e logo Zero Cento
 */
interface FullPageLoaderProps {
    message?: string
    messageKey?: string
}

export function FullPageLoader({ message, messageKey = 'common.loadingPageTransition' }: FullPageLoaderProps) {
    const { t } = useTranslation('common')
    const resolvedMessage = message ?? t(messageKey, { defaultValue: t('common.loadingProgress') })

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-b from-amber-50 via-white to-white">
            {/* Decorative brand accents */}
            <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-brand-primary/10 blur-3xl" aria-hidden="true"></div>
            <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-brand-primary/10 blur-3xl" aria-hidden="true"></div>

            <div className="relative flex min-h-screen items-center justify-center px-6">
                <div className="w-full max-w-sm rounded-3xl border border-brand-primary/20 bg-white/90 p-8 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-6 text-center">
                        <Image
                            src="/images/logo/logo.png"
                            alt="Zero Cento"
                            width={156}
                            height={48}
                            priority
                            className="h-auto w-auto max-w-[156px]"
                        />

                        <LoadingSpinner size="lg" color="primary" />

                        <p className="text-sm font-medium text-gray-700">{resolvedMessage}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                            {t('brand.tagline', { defaultValue: t('app.tagline') })}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * InlineLoader Component
 * Small inline loader for buttons or small sections
 */
export function InlineLoader({ className = '' }: { className?: string }) {
    return (
        <span className={`inline-block ${className}`}>
            <LoadingSpinner size="sm" color="primary" />
        </span>
    )
}

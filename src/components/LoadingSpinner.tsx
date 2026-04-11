'use client'

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
export function FullPageLoader({ message }: { message?: string }) {
    const { t } = useTranslation('common')
    const resolvedMessage = message ?? t('common.loadingEllipsis', { defaultValue: t('common.loading') })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6">
                {/* Zero Cento Logo/Text */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold">
                        <span className="text-gray-900">Zero</span>
                        <span className="text-brand-primary">Cento</span>
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">{t('brand.tagline', { defaultValue: t('app.tagline') })}</p>
                </div>

                <LoadingSpinner size="lg" color="primary" />

                <p className="text-sm text-gray-600">{resolvedMessage}</p>
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

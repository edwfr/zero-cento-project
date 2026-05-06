'use client'

interface ProgressBarProps {
    current: number
    total: number
    label?: string
    showPercentage?: boolean
    showCurrentTotal?: boolean
    size?: 'sm' | 'md' | 'lg'
    color?: 'primary' | 'success' | 'warning' | 'danger'
    barClassName?: string
    labelClassName?: string
    className?: string
}

/**
 * ProgressBar Component
 * Animated progress bar with labels and color variants
 */
export default function ProgressBar({
    current,
    total,
    label,
    showPercentage = true,
    showCurrentTotal = true,
    size = 'md',
    color = 'primary',
    barClassName = '',
    labelClassName = 'text-sm font-semibold text-gray-700',
    className = '',
}: ProgressBarProps) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0

    const sizeClasses = {
        sm: 'h-2',
        md: 'h-3',
        lg: 'h-4',
    }

    const colorClasses = {
        primary: 'bg-brand-primary',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        danger: 'bg-red-500',
    }

    return (
        <div className={className}>
            {(label || showPercentage) && (
                <div className="flex items-center justify-between mb-2">
                    {label && <span className={labelClassName}>{label}</span>}
                    {showPercentage && (
                        <span className="text-sm font-semibold text-gray-900">{percentage}%</span>
                    )}
                </div>
            )}

            <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
                <div
                    className={`${barClassName || colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                    role="progressbar"
                    aria-valuenow={current}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-label={label || `Progress: ${percentage}%`}
                />
            </div>

            {showCurrentTotal && total > 0 && (
                <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-600">
                        {current} / {total}
                    </span>
                </div>
            )}
        </div>
    )
}

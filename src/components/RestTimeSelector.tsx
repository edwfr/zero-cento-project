'use client'

import { RestTime } from '@prisma/client'

interface RestTimeSelectorProps {
    value: RestTime | undefined
    onChange: (value: RestTime) => void
    disabled?: boolean
    className?: string
    required?: boolean
}

const REST_TIME_OPTIONS = [
    { value: 's30' as RestTime, label: '30s', seconds: 30 },
    { value: 'm1' as RestTime, label: '1m', seconds: 60 },
    { value: 'm2' as RestTime, label: '2m', seconds: 120 },
    { value: 'm3' as RestTime, label: '3m', seconds: 180 },
    { value: 'm5' as RestTime, label: '5m', seconds: 300 },
]

export default function RestTimeSelector({
    value,
    onChange,
    disabled = false,
    className = '',
    required = false,
}: RestTimeSelectorProps) {
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <label className="text-sm font-medium text-gray-700">
                Tempo Recupero {required && <span className="text-red-500">*</span>}
            </label>
            <div className="flex gap-2">
                {REST_TIME_OPTIONS.map((option) => {
                    const isSelected = value === option.value
                    return (
                        <button
                            key={option.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(option.value)}
                            className={`
                                min-h-touch min-w-touch flex-1 rounded-lg border-2 px-4 py-2 text-center font-semibold
                                transition-all duration-200
                                ${isSelected
                                    ? 'border-brand-primary bg-brand-primary text-white shadow-md'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary/50 hover:bg-brand-primary/5'
                                }
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:ring-offset-2
                            `}
                        >
                            {option.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

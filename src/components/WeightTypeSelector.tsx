'use client'

import { WeightType } from '@prisma/client'

interface WeightTypeSelectorProps {
    value: WeightType
    onChange: (value: WeightType) => void
    disabled?: boolean
    className?: string
}

const WEIGHT_TYPE_OPTIONS = [
    { value: 'absolute' as WeightType, label: 'kg', description: 'Peso assoluto' },
    { value: 'percentage_1rm' as WeightType, label: '% 1RM', description: 'Percentuale massimale' },
    { value: 'percentage_rm' as WeightType, label: '% nRM', description: 'Percentuale di nRM' },
    {
        value: 'percentage_previous' as WeightType,
        label: '% Prev',
        description: 'Relativo alla prima occorrenza',
    },
]

export default function WeightTypeSelector({
    value,
    onChange,
    disabled = false,
    className = '',
}: WeightTypeSelectorProps) {
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <label className="text-sm font-medium text-gray-700">Tipo Peso</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WEIGHT_TYPE_OPTIONS.map((option) => {
                    const isSelected = value === option.value
                    return (
                        <button
                            key={option.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange(option.value)}
                            className={`
                                min-h-touch flex flex-col items-center justify-center rounded-lg border-2 px-3 py-2
                                transition-all duration-200
                                ${isSelected
                                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary/50'
                                }
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:ring-offset-2
                            `}
                            title={option.description}
                        >
                            <span className="text-sm font-bold">{option.label}</span>
                            <span className="text-xs opacity-75">{option.description}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

'use client'

import { useState } from 'react'

interface RPESelectorProps {
    value: number | null
    onChange: (value: number | null) => void
    disabled?: boolean
    className?: string
    showLabel?: boolean
}

// RPE 5.0 - 10.0 con incrementi di 0.5
const RPE_VALUES = [
    5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
]

const RPE_COLORS: Record<number, string> = {
    5.0: 'bg-green-500',
    5.5: 'bg-green-500',
    6.0: 'bg-green-400',
    6.5: 'bg-green-400',
    7.0: 'bg-yellow-400',
    7.5: 'bg-yellow-400',
    8.0: 'bg-orange-400',
    8.5: 'bg-orange-500',
    9.0: 'bg-red-500',
    9.5: 'bg-red-600',
    10.0: 'bg-red-700',
}

const RPE_DESCRIPTIONS: Record<number, string> = {
    5.0: 'Molto facile',
    6.0: 'Facile',
    7.0: 'Moderato',
    8.0: 'Impegnativo',
    9.0: 'Molto duro',
    10.0: 'Massimale',
}

export default function RPESelector({
    value,
    onChange,
    disabled = false,
    className = '',
    showLabel = true,
}: RPESelectorProps) {
    const [isOpen, setIsOpen] = useState(false)

    const getRPEDescription = (rpe: number | null): string => {
        if (!rpe) return 'Non selezionato'
        const baseRPE = Math.floor(rpe)
        return RPE_DESCRIPTIONS[baseRPE] || 'N/A'
    }

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {showLabel && <label className="text-sm font-medium text-gray-700">RPE (Fatica Percepita)</label>}

            {/* Compact Selector Button */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    min-h-touch flex items-center justify-between rounded-lg border-2 px-4 py-2
                    transition-all duration-200
                    ${value
                        ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                        : 'border-gray-300 bg-white text-gray-700'
                    }
                    ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-brand-primary/50'}
                    focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:ring-offset-2
                `}
            >
                <span className="font-semibold">
                    {value ? `RPE ${value.toFixed(1)}` : 'Seleziona RPE'}
                </span>
                <span className="text-xs opacity-75">{getRPEDescription(value)}</span>
            </button>

            {/* Dropdown Grid */}
            {isOpen && !disabled && (
                <div className="relative z-10">
                    <div className="absolute left-0 right-0 mt-1 rounded-lg border border-gray-300 bg-white p-3 shadow-lg">
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                            {RPE_VALUES.map((rpe) => {
                                const isSelected = value === rpe
                                const baseRPE = Math.floor(rpe)
                                const colorClass = RPE_COLORS[baseRPE] || 'bg-gray-400'

                                return (
                                    <button
                                        key={rpe}
                                        type="button"
                                        onClick={() => {
                                            onChange(rpe)
                                            setIsOpen(false)
                                        }}
                                        className={`
                                            min-h-touch flex flex-col items-center justify-center rounded-lg border-2 px-2 py-2
                                            transition-all duration-200
                                            ${isSelected
                                                ? 'border-brand-primary scale-105 shadow-md'
                                                : 'border-transparent hover:border-brand-primary/50 hover:scale-105'
                                            }
                                            focus:outline-none focus:ring-2 focus:ring-brand-primary/50
                                        `}
                                    >
                                        <div className={`${colorClass} mb-1 h-3 w-full rounded`}></div>
                                        <span className="text-sm font-bold">{rpe.toFixed(1)}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    onChange(null)
                                    setIsOpen(false)
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700 underline"
                            >
                                Rimuovi
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-xs font-medium text-brand-primary hover:text-brand-primary/80"
                            >
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

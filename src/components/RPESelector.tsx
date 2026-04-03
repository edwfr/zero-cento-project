'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface RPESelectorProps {
    value: number | null
    onChange: (value: number | null) => void
    disabled?: boolean
    className?: string
    showLabel?: boolean
    centeredMenu?: boolean
    label?: string
    title?: string
    placeholder?: string
    descriptions?: Partial<Record<number, string>>
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
    centeredMenu = false,
    label = 'RPE (Fatica Percepita)',
    title,
    placeholder = 'Seleziona RPE',
    descriptions,
}: RPESelectorProps) {
    const { t } = useTranslation('common')
    const [isOpen, setIsOpen] = useState(false)
    const dialogRef = useRef<HTMLDivElement>(null)

    const getRPEDescription = (rpe: number | null): string => {
        if (!rpe) return placeholder
        const translatedDescription = descriptions?.[rpe]

        if (translatedDescription) {
            return translatedDescription
        }

        const baseRPE = Math.floor(rpe)
        return RPE_DESCRIPTIONS[baseRPE] || 'N/A'
    }

    useEffect(() => {
        if (!isOpen || !centeredMenu) {
            return
        }

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
            }
        }

        document.addEventListener('keydown', handleEscape)

        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', handleEscape)
        }
    }, [centeredMenu, isOpen])

    const selectedLabel = value ? `RPE ${value.toFixed(1)}` : placeholder
    const modalTitle = title || label
    const optionsGrid = (
        <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                                flex flex-col items-center justify-center rounded-md border-2 px-2 py-2
                                transition-all duration-200 bg-white
                                ${isSelected
                                    ? 'border-brand-primary scale-105 shadow-md'
                                    : 'border-gray-200 hover:border-brand-primary/70 hover:scale-105'
                                }
                                focus:outline-none focus:ring-2 focus:ring-brand-primary/50
                            `}
                        >
                            <div className={`${colorClass} mb-1.5 h-2 w-full rounded`}></div>
                            <span className="text-sm font-bold text-gray-900">{rpe.toFixed(1)}</span>
                        </button>
                    )
                })}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => {
                        onChange(null)
                        setIsOpen(false)
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                    {t('common.deselect')}
                </button>
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-sm font-medium text-brand-primary hover:text-brand-primary/80"
                >
                    {t('common.close')}
                </button>
            </div>
        </>
    )

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {showLabel && <label className="text-sm font-medium text-gray-700">{label}</label>}

            {/* Compact Selector Button */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center justify-between rounded-lg border-2 px-3 py-1.5
                    transition-all duration-200
                    ${value
                        ? 'border-brand-primary bg-white text-gray-900'
                        : 'border-gray-300 bg-white text-gray-700'
                    }
                    ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-brand-primary/70'}
                    focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:ring-offset-1
                `}
            >
                <span className="text-sm font-semibold">
                    {selectedLabel}
                </span>
                <span className="text-xs text-gray-600 ml-2">{getRPEDescription(value)}</span>
            </button>

            {/* Dropdown Grid */}
            {isOpen && !disabled && (
                centeredMenu ? (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        onClick={() => setIsOpen(false)}
                        role="presentation"
                    >
                        <div
                            ref={dialogRef}
                            role="dialog"
                            aria-modal="true"
                            aria-label={modalTitle}
                            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-2xl"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-gray-900">{modalTitle}</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    {value ? getRPEDescription(value) : placeholder}
                                </p>
                            </div>
                            {optionsGrid}
                        </div>
                    </div>
                ) : (
                    <div className="relative z-10">
                        <div className="absolute left-0 right-0 mt-1 rounded-lg border border-gray-300 bg-white p-2 shadow-lg">
                            {optionsGrid}
                        </div>
                    </div>
                )
            )}
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'

interface RepsInputProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    className?: string
    placeholder?: string
    showLabel?: boolean
}

/**
 * RepsInput component
 * Supports multiple formats:
 * - Single number: "8"
 * - Range: "8-10"
 * - Slash notation: "6/8"
 * - Validation: only digits, hyphens, slashes
 */
export default function RepsInput({
    value,
    onChange,
    disabled = false,
    className = '',
    placeholder = 'es. 8, 8-10, 6/8',
    showLabel = true,
}: RepsInputProps) {
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Validate input format
        if (!value) {
            setError(null)
            return
        }

        const validPattern = /^[0-9]+(-[0-9]+|\/[0-9]+)?$/
        if (!validPattern.test(value)) {
            setError('Formato non valido (es. 8, 8-10, 6/8)')
        } else {
            setError(null)
        }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        // Allow only digits, hyphens, and slashes
        if (newValue === '' || /^[0-9\-/]+$/.test(newValue)) {
            onChange(newValue)
        }
    }

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {showLabel && <label className="text-sm font-medium text-gray-700">Ripetizioni</label>}
            <input
                type="text"
                value={value}
                onChange={handleChange}
                disabled={disabled}
                placeholder={placeholder}
                className={`
                    min-h-touch rounded-lg border-2 px-4 py-2 text-center font-semibold
                    transition-all duration-200
                    ${error
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : value
                            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                            : 'border-gray-300 bg-white text-gray-700'
                    }
                    ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-brand-primary/50'}
                    focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:ring-offset-2
                    placeholder:text-gray-400 placeholder:font-normal
                `}
            />
            {error && <span className="text-xs text-red-600">{error}</span>}
            <span className="text-xs text-gray-500">
                Formati: numero singolo (8), range (8-10), slash (6/8)
            </span>
        </div>
    )
}

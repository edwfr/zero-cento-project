'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'

interface DatePickerProps {
    value?: string // ISO date string YYYY-MM-DD
    onChange: (date: string) => void
    label?: string
    placeholder?: string
    min?: string // YYYY-MM-DD
    max?: string // YYYY-MM-DD
    disabled?: boolean
    required?: boolean
    error?: string
    className?: string
    id?: string
}

/**
 * DatePicker Component
 * Native date input with custom styling matching the ZeroCento brand.
 * Falls back gracefully on browsers that don't support date inputs.
 */
export default function DatePicker({
    value = '',
    onChange,
    label,
    placeholder,
    min,
    max,
    disabled = false,
    required = false,
    error,
    className = '',
    id,
}: DatePickerProps) {
    const { t } = useTranslation('common')
    const inputId = id || `datepicker-${Math.random().toString(36).slice(2, 9)}`
    const resolvedPlaceholder = placeholder ?? t('common.dateFormat')

    // Format YYYY-MM-DD to display as GG/MM/AAAA for Italian locale
    const formatDisplay = (iso: string) => {
        if (!iso) return ''
        const [year, month, day] = iso.split('-')
        return `${day}/${month}/${year}`
    }

    // Parse GG/MM/AAAA input back to YYYY-MM-DD
    const parseInput = (display: string): string => {
        const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (!match) return ''
        const [, day, month, year] = match
        const date = new Date(`${year}-${month}-${day}`)
        if (isNaN(date.getTime())) return ''
        return `${year}-${month}-${day}`
    }

    const [textValue, setTextValue] = useState(formatDisplay(value))
    const [showNative, setShowNative] = useState(false)
    const nativeRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setTextValue(formatDisplay(value))
    }, [value])

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value
        setTextValue(raw)
        const iso = parseInput(raw)
        if (iso) onChange(iso)
    }

    const handleTextBlur = () => {
        // If the text isn't a valid date, reset to previous valid value
        const iso = parseInput(textValue)
        if (!iso && textValue !== '') {
            setTextValue(formatDisplay(value))
        }
    }

    const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const iso = e.target.value // Already YYYY-MM-DD
        onChange(iso)
        setTextValue(formatDisplay(iso))
        setShowNative(false)
    }

    return (
        <div className="relative">
            {label && (
                <FormLabel htmlFor={inputId} required={required}>
                    {label}
                </FormLabel>
            )}

            <div className="relative flex items-center">
                {/* Text input for manual entry */}
                <Input
                    id={inputId}
                    type="text"
                    value={textValue}
                    onChange={handleTextChange}
                    onBlur={handleTextBlur}
                    placeholder={resolvedPlaceholder}
                    disabled={disabled}
                    required={required}
                    inputSize="md"
                    state={error ? 'error' : 'default'}
                    className={`text-gray-900 bg-white ${className}`}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    maxLength={10}
                />

                {/* Calendar icon button to open native date picker */}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        setShowNative(true)
                        setTimeout(() => nativeRef.current?.showPicker?.(), 50)
                    }}
                    className="absolute right-3 text-gray-400 hover:text-brand-primary transition-colors disabled:opacity-40"
                    aria-label={t('common.openCalendar')}
                    tabIndex={-1}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                </button>

                {/* Hidden native date input for picker UI */}
                {showNative && (
                    <input
                        ref={nativeRef}
                        type="date"
                        value={value}
                        min={min}
                        max={max}
                        onChange={handleNativeChange}
                        onBlur={() => setShowNative(false)}
                        className="sr-only"
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                )}
            </div>

            {error && (
                <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600">
                    {error}
                </p>
            )}
        </div>
    )
}


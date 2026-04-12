'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/Input'

export interface AutocompleteOption {
    id: string
    label: string
    sublabel?: string
}

interface AutocompleteSearchProps {
    options: AutocompleteOption[]
    value?: string // Selected option id
    onSelect: (option: AutocompleteOption | null) => void
    onSearch?: (query: string) => void // Called when text changes (for async search)
    label?: string
    placeholder?: string
    loading?: boolean
    disabled?: boolean
    required?: boolean
    error?: string
    emptyMessage?: string
    className?: string
    id?: string
}

/**
 * AutocompleteSearch Component
 * Searchable dropdown with keyboard navigation.
 * Supports both static options and async search (via onSearch callback).
 */
export default function AutocompleteSearch({
    options,
    value,
    onSelect,
    onSearch,
    label,
    placeholder,
    loading = false,
    disabled = false,
    required = false,
    error,
    emptyMessage,
    className = '',
    id,
}: AutocompleteSearchProps) {
    const { t } = useTranslation(['common', 'components'])
    const inputId = id || `autocomplete-${Math.random().toString(36).slice(2, 9)}`
    const resolvedPlaceholder = placeholder ?? `${t('common:common.search')}...`
    const resolvedEmptyMessage = emptyMessage ?? t('common:common.noResultsFound', {
        defaultValue: t('components:autocomplete.noResults'),
    })
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Compute label of currently selected option
    const selectedOption = options.find((o) => o.id === value)

    // Initialize query from selected option label
    useEffect(() => {
        if (selectedOption && !isOpen) {
            setQuery(selectedOption.label)
        }
    }, [selectedOption, isOpen])

    // Filtered options (when no async search provided)
    const filteredOptions =
        onSearch
            ? options // async: parent handles filtering
            : options.filter(
                (o) =>
                    o.label.toLowerCase().includes(query.toLowerCase()) ||
                    o.sublabel?.toLowerCase().includes(query.toLowerCase())
            )

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setQuery(val)
        setIsOpen(true)
        setActiveIndex(-1)
        onSearch?.(val)
        // If user clears input, deselect
        if (!val) onSelect(null)
    }

    const handleSelect = useCallback(
        (option: AutocompleteOption) => {
            setQuery(option.label)
            setIsOpen(false)
            setActiveIndex(-1)
            onSelect(option)
        },
        [onSelect]
    )

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') setIsOpen(true)
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, filteredOptions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, -1))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (activeIndex >= 0 && filteredOptions[activeIndex]) {
                handleSelect(filteredOptions[activeIndex])
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false)
            setActiveIndex(-1)
            // Restore selected label on escape
            setQuery(selectedOption?.label ?? '')
        }
    }

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setIsOpen(false)
                // Restore selected label if user clicked away without selecting
                setQuery(selectedOption?.label ?? '')
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [selectedOption])

    // Scroll active item into view
    useEffect(() => {
        if (activeIndex >= 0 && listRef.current) {
            const item = listRef.current.children[activeIndex] as HTMLElement
            item?.scrollIntoView({ block: 'nearest' })
        }
    }, [activeIndex])

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {label && (
                <label htmlFor={inputId} className="block text-sm font-semibold text-gray-700 mb-1">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                <Input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-autocomplete="list"
                    aria-controls={`${inputId}-list`}
                    aria-activedescendant={
                        activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined
                    }
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={resolvedPlaceholder}
                    disabled={disabled}
                    required={required}
                    autoComplete="off"
                    inputSize="md"
                    state={error ? 'error' : 'default'}
                    className="pr-10"
                    aria-invalid={!!error}
                />

                {/* Chevron icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#FFA700] border-t-transparent" />
                    ) : (
                        <svg
                            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    )}
                </div>
            </div>

            {/* Dropdown list */}
            {isOpen && (
                <ul
                    ref={listRef}
                    id={`${inputId}-list`}
                    role="listbox"
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
                >
                    {loading ? (
                        <li className="px-4 py-3 text-sm text-gray-500 text-center">
                            {t('common:common.loading')}
                        </li>
                    ) : filteredOptions.length === 0 ? (
                        <li className="px-4 py-3 text-sm text-gray-500 text-center">
                            {resolvedEmptyMessage}
                        </li>
                    ) : (
                        filteredOptions.map((option, index) => (
                            <li
                                key={option.id}
                                id={`${inputId}-option-${index}`}
                                role="option"
                                aria-selected={option.id === value}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    handleSelect(option)
                                }}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`
                                    px-4 py-2 cursor-pointer transition-colors text-sm
                                    ${index === activeIndex ? 'bg-brand-primary/10 text-[#FFA700]' : 'hover:bg-gray-50'}
                                    ${option.id === value ? 'font-semibold' : ''}
                                `}
                            >
                                <div className="font-medium">{option.label}</div>
                                {option.sublabel && (
                                    <div className="text-xs text-gray-500">{option.sublabel}</div>
                                )}
                            </li>
                        ))
                    )}
                </ul>
            )}

            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
    )
}

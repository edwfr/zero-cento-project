import { TextareaHTMLAttributes, forwardRef } from 'react'

export type TextareaState = 'default' | 'error' | 'success'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    state?: TextareaState
    helperText?: string
    showCharCount?: boolean
    maxLength?: number
}

/**
 * Textarea component - design system unified multiline text input
 * 
 * @example
 * ```tsx
 * <Textarea placeholder="Note..." rows={4} />
 * <Textarea state="error" helperText="Campo obbligatorio" />
 * <Textarea showCharCount maxLength={500} />
 * ```
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
    state = 'default',
    helperText,
    showCharCount = false,
    maxLength,
    className = '',
    disabled,
    value,
    ...props
}, ref) => {
    // Base styles
    const baseStyles = 'w-full border rounded-lg px-4 py-2 text-base transition-colors focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500 resize-y'

    // State styles (border and focus ring)
    const stateStyles: Record<TextareaState, string> = {
        default: 'border-gray-300 focus:ring-brand-primary',
        error: 'border-red-500 focus:ring-red-500',
        success: 'border-green-500 focus:ring-green-500',
    }

    const combinedClassName = `${baseStyles} ${stateStyles[state]} ${className}`.trim()

    // Helper text color
    const helperTextColor = state === 'error' ? 'text-red-600' : state === 'success' ? 'text-green-600' : 'text-gray-600'

    // Character count
    const currentLength = typeof value === 'string' ? value.length : 0

    return (
        <div className="w-full">
            <textarea
                ref={ref}
                className={combinedClassName}
                disabled={disabled}
                maxLength={maxLength}
                value={value}
                {...props}
            />
            <div className="mt-1.5 flex items-center justify-between">
                {helperText && (
                    <p className={`text-sm ${helperTextColor}`}>
                        {helperText}
                    </p>
                )}
                {showCharCount && maxLength && (
                    <p className={`text-sm ${currentLength > maxLength * 0.9 ? 'text-yellow-600 font-semibold' : 'text-gray-500'}`}>
                        {currentLength}/{maxLength}
                    </p>
                )}
            </div>
        </div>
    )
})

Textarea.displayName = 'Textarea'

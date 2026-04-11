import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'

export type InputSize = 'md' | 'lg'
export type InputState = 'default' | 'error' | 'success'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    inputSize?: InputSize
    state?: InputState
    helperText?: string
    icon?: ReactNode
    iconPosition?: 'left' | 'right'
}

/**
 * Input component - design system unified text input
 * 
 * @example
 * ```tsx
 * <Input placeholder="Email..." />
 * <Input inputSize="lg" state="error" helperText="Campo obbligatorio" />
 * <Input state="success" helperText="Email valida" />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
    inputSize = 'md',
    state = 'default',
    helperText,
    icon,
    iconPosition = 'left',
    className = '',
    disabled,
    ...props
}, ref) => {
    // Base styles
    const baseStyles = 'w-full border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500'

    // Size styles
    const sizeStyles: Record<InputSize, string> = {
        md: 'px-4 py-2 text-base',
        lg: 'px-4 py-3 text-base',
    }

    // State styles (border and focus ring)
    const stateStyles: Record<InputState, string> = {
        default: 'border-gray-300 focus:ring-brand-primary',
        error: 'border-red-500 focus:ring-red-500',
        success: 'border-green-500 focus:ring-green-500',
    }

    // Icon padding adjustment
    const iconPadding = icon
        ? iconPosition === 'left'
            ? 'pl-10'
            : 'pr-10'
        : ''

    const combinedClassName = `${baseStyles} ${sizeStyles[inputSize]} ${stateStyles[state]} ${iconPadding} ${className}`.trim()

    // Helper text color
    const helperTextColor = state === 'error' ? 'text-red-600' : state === 'success' ? 'text-green-600' : 'text-gray-600'

    return (
        <div className="w-full">
            <div className="relative">
                {icon && (
                    <div className={`absolute ${iconPosition === 'left' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-gray-400`}>
                        {icon}
                    </div>
                )}
                <input
                    ref={ref}
                    className={combinedClassName}
                    disabled={disabled}
                    {...props}
                />
            </div>
            {helperText && (
                <p className={`mt-1.5 text-sm ${helperTextColor}`}>
                    {helperText}
                </p>
            )}
        </div>
    )
})

Input.displayName = 'Input'

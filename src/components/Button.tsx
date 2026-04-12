import { ButtonHTMLAttributes, ReactNode } from 'react'
import LoadingSpinner from './LoadingSpinner'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant
    size?: ButtonSize
    isLoading?: boolean
    loadingText?: string
    icon?: ReactNode
    iconPosition?: 'left' | 'right'
    fullWidth?: boolean
}

/**
 * Button component - design system unified button
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="md">Save</Button>
 * <Button variant="secondary" size="sm" icon={<Icon />}>Cancel</Button>
 * <Button variant="danger" isLoading>Delete</Button>
 * ```
 */
export function Button({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    children,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    // Base styles
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    // Variant styles
    const variantStyles: Record<ButtonVariant, string> = {
        primary: 'bg-brand-primary hover:bg-brand-primary-hover text-white focus:ring-brand-primary',
        secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400',
        danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    }

    // Size styles
    const sizeStyles: Record<ButtonSize, string> = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    }

    // Width style
    const widthStyle = fullWidth ? 'w-full' : ''

    // Icon size based on button size
    const iconSizeClass = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-5 h-5' : 'w-6 h-6'
    const iconGap = size === 'sm' ? 'gap-1.5' : 'gap-2'

    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${icon ? iconGap : ''} ${className}`.trim()

    const isDisabled = disabled || isLoading

    return (
        <button
            className={combinedClassName}
            disabled={isDisabled}
            {...props}
        >
            {isLoading && (
                <LoadingSpinner
                    size={size === 'sm' ? 'sm' : size === 'lg' ? 'md' : 'sm'}
                    className="mr-2"
                />
            )}
            {!isLoading && icon && iconPosition === 'left' && (
                <span className={iconSizeClass}>{icon}</span>
            )}
            <span>{isLoading && loadingText ? loadingText : children}</span>
            {!isLoading && icon && iconPosition === 'right' && (
                <span className={iconSizeClass}>{icon}</span>
            )}
        </button>
    )
}

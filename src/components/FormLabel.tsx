import { LabelHTMLAttributes } from 'react'

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean
}

/**
 * FormLabel component - design system unified form label
 * 
 * @example
 * ```tsx
 * <FormLabel htmlFor="email">Email</FormLabel>
 * <FormLabel htmlFor="name" required>Nome completo</FormLabel>
 * ```
 */
export function FormLabel({
    required = false,
    children,
    className = '',
    ...props
}: FormLabelProps) {
    const baseStyles = 'block text-sm font-medium text-gray-700 mb-1'
    const combinedClassName = `${baseStyles} ${className}`.trim()

    return (
        <label className={combinedClassName} {...props}>
            {children}
            {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
    )
}

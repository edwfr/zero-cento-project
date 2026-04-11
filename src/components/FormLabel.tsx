import { LabelHTMLAttributes, ReactNode } from 'react'

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean
    tooltip?: string
    badge?: ReactNode
}

/**
 * FormLabel component - design system unified form label
 * 
 * @example
 * ```tsx
 * <FormLabel htmlFor="email">Email</FormLabel>
 * <FormLabel htmlFor="name" required>Nome completo</FormLabel>
 * <FormLabel htmlFor="bio" badge={<span className="text-xs">Opzionale</span>}>Bio</FormLabel>
 * ```
 */
export function FormLabel({
    required = false,
    tooltip,
    badge,
    children,
    className = '',
    ...props
}: FormLabelProps) {
    const baseStyles = 'block text-sm font-medium text-gray-700 mb-1'
    const combinedClassName = `${baseStyles} ${className}`.trim()

    return (
        <label className={combinedClassName} {...props}>
            <span className="flex items-center gap-2">
                <span>
                    {children}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </span>
                {badge && <span>{badge}</span>}
                {tooltip && (
                    <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-xs cursor-help"
                        title={tooltip}
                    >
                        ?
                    </span>
                )}
            </span>
        </label>
    )
}

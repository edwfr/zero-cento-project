import { HTMLAttributes, ReactNode } from 'react'

export type CardVariant = 'base' | 'elevated'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant
    header?: {
        title: string
        subtitle?: string
        badge?: ReactNode
        actions?: ReactNode
    }
    footer?: {
        actions?: ReactNode
        links?: ReactNode
    }
    padding?: 'none' | 'sm' | 'md' | 'lg'
}

/**
 * Card component - design system unified card container
 * 
 * @example
 * ```tsx
 * <Card variant="base">Content here</Card>
 * <Card variant="elevated" header={{ title: "Title", badge: <Badge /> }}>
 *   Content
 * </Card>
 * <Card footer={{ actions: <Button>Action</Button> }}>Content</Card>
 * ```
 */
export function Card({
    variant = 'base',
    header,
    footer,
    padding = 'md',
    children,
    className = '',
    ...props
}: CardProps) {
    // Variant styles
    const variantStyles: Record<CardVariant, string> = {
        base: 'bg-white rounded-xl shadow-sm border border-gray-200',
        elevated: 'bg-white rounded-xl shadow-lg',
    }

    // Padding styles
    const paddingStyles: Record<typeof padding, string> = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    }

    const combinedClassName = `${variantStyles[variant]} ${paddingStyles[padding]} ${className}`.trim()

    return (
        <div className={combinedClassName} {...props}>
            {header && (
                <div className={`${padding !== 'none' ? '-mt-6 -mx-6 px-6 py-4' : 'px-6 py-4'} border-b border-gray-200 mb-6`}>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {header.title}
                                </h3>
                                {header.badge && <div>{header.badge}</div>}
                            </div>
                            {header.subtitle && (
                                <p className="mt-1 text-sm text-gray-600">
                                    {header.subtitle}
                                </p>
                            )}
                        </div>
                        {header.actions && (
                            <div className="ml-4">
                                {header.actions}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div>{children}</div>

            {footer && (
                <div className={`${padding !== 'none' ? '-mb-6 -mx-6 px-6 py-4' : 'px-6 py-4'} border-t border-gray-200 mt-6 flex items-center justify-between`}>
                    {footer.links && <div>{footer.links}</div>}
                    {footer.actions && <div className="ml-auto">{footer.actions}</div>}
                </div>
            )}
        </div>
    )
}

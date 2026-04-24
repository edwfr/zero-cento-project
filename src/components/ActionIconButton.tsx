import Link from 'next/link'
import { FileEdit, Eye, FlaskConical, Trash2, Loader2, type LucideIcon } from 'lucide-react'

export type ActionVariant = 'edit' | 'view' | 'view-test' | 'delete'

export interface ActionIconButtonProps {
    variant: ActionVariant
    label: string
    href?: string
    onClick?: () => void
    disabled?: boolean
    isLoading?: boolean
}

const VARIANT_CONFIG: Record<ActionVariant, { Icon: LucideIcon; activeClass: string }> = {
    edit: { Icon: FileEdit, activeClass: 'bg-green-600 hover:bg-green-700' },
    view: { Icon: Eye, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
    'view-test': { Icon: FlaskConical, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
    delete: { Icon: Trash2, activeClass: 'bg-red-600 hover:bg-red-700' },
}

const BASE =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors'
const DISABLED_CLASS = 'bg-gray-200 text-gray-500 cursor-not-allowed'

export function ActionIconButton({
    variant,
    label,
    href,
    onClick,
    disabled = false,
    isLoading = false,
}: ActionIconButtonProps) {
    const { Icon, activeClass } = VARIANT_CONFIG[variant]
    const isDisabled = disabled || isLoading
    const className = `${BASE} ${isDisabled ? DISABLED_CLASS : activeClass}`
    const icon = isLoading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Icon className="w-4 h-4" />

    if (href && !isDisabled) {
        return (
            <Link href={href} className={className} title={label} aria-label={label}>
                {icon}
            </Link>
        )
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            className={className}
            title={label}
            aria-label={label}
        >
            {icon}
        </button>
    )
}

export function InlineActions({ children }: { children: React.ReactNode }) {
    return <div className="flex items-center justify-end gap-2">{children}</div>
}

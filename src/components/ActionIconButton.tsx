import Link from 'next/link'
import { FileEdit, Eye, FlaskConical, Trash2, Loader2, UserCheck, UserX, Copy, FileDown, type LucideIcon } from 'lucide-react'

export type ActionVariant = 'edit' | 'view' | 'view-test' | 'delete' | 'activate' | 'deactivate' | 'clone' | 'export-pdf'

export interface ActionIconButtonProps {
    variant: ActionVariant
    label: string
    /** Descriptive hover text; falls back to `label`. */
    tooltip?: string
    href?: string
    onClick?: () => void
    disabled?: boolean
    isLoading?: boolean
    tabIndex?: number
    className?: string
}

const VARIANT_CONFIG: Record<ActionVariant, { Icon: LucideIcon; activeClass: string }> = {
    edit: { Icon: FileEdit, activeClass: 'bg-green-600 hover:bg-green-700' },
    view: { Icon: Eye, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
    'view-test': { Icon: FlaskConical, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
    delete: { Icon: Trash2, activeClass: 'bg-red-600 hover:bg-red-700' },
    activate: { Icon: UserCheck, activeClass: 'bg-green-600 hover:bg-green-700' },
    deactivate: { Icon: UserX, activeClass: 'bg-red-600 hover:bg-red-700' },
    clone: { Icon: Copy, activeClass: 'bg-indigo-600 hover:bg-indigo-700' },
    'export-pdf': { Icon: FileDown, activeClass: 'bg-brand-primary hover:bg-brand-primary-hover' },
}

const BASE =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-colors'
const DISABLED_CLASS = 'bg-gray-200 text-gray-500 cursor-not-allowed'
const TOOLTIP_CLASS =
    'pointer-events-none invisible absolute bottom-full right-0 z-20 mb-2 w-max max-w-[16rem] rounded-md bg-gray-900 px-2 py-1 text-left text-xs font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity delay-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'

export function ActionIconButton({
    variant,
    label,
    tooltip,
    href,
    onClick,
    disabled = false,
    isLoading = false,
    tabIndex,
    className,
}: ActionIconButtonProps) {
    const { Icon, activeClass } = VARIANT_CONFIG[variant]
    const isDisabled = disabled || isLoading
    const baseClassName = `${BASE} ${isDisabled ? DISABLED_CLASS : activeClass}`
    const finalClassName = className ? `${baseClassName} ${className}` : baseClassName
    const icon = isLoading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <Icon className="w-4 h-4" />

    const control = href && !isDisabled ? (
        <Link href={href} className={finalClassName} aria-label={label} tabIndex={tabIndex}>
            {icon}
        </Link>
    ) : (
        <button
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            className={finalClassName}
            aria-label={label}
            tabIndex={tabIndex}
        >
            {icon}
        </button>
    )

    return (
        <span className="group relative inline-flex shrink-0">
            {control}
            <span role="tooltip" className={TOOLTIP_CLASS}>
                {tooltip ?? label}
            </span>
        </span>
    )
}

export function InlineActions({ children }: { children: React.ReactNode }) {
    return <div className="flex items-center justify-end gap-2">{children}</div>
}

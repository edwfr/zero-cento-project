'use client'

interface MovementPatternTagProps {
    name: string
    color?: string
    onClick?: () => void
    className?: string
    compact?: boolean
}

/**
 * MovementPatternTag Component
 * Badge colorato per schema motorio con colore personalizzato trainer
 * Usato in vista alto livello per identificare rapidamente il tipo di movimento
 */
export default function MovementPatternTag({
    name,
    color = 'rgb(var(--brand-primary))',
    onClick,
    className = '',
    compact = false,
}: MovementPatternTagProps) {
    // Convert hex to RGB for transparency
    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result
            ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
            }
            : { r: 255, g: 167, b: 0 }
    }

    const usesBrandToken = color.includes('var(--brand-primary)')
    const rgb = usesBrandToken ? null : hexToRgb(color)
    const backgroundColor = usesBrandToken
        ? 'rgba(var(--brand-primary), 0.15)'
        : `rgba(${rgb!.r}, ${rgb!.g}, ${rgb!.b}, 0.15)`
    const borderColor = usesBrandToken
        ? 'rgba(var(--brand-primary), 0.5)'
        : `rgba(${rgb!.r}, ${rgb!.g}, ${rgb!.b}, 0.5)`

    return (
        <span
            className={`
                inline-flex items-center rounded-full border text-xs font-semibold
                ${compact ? 'px-1.5 py-1' : 'gap-1 px-2 py-0.5'}
                transition-all duration-200
                ${onClick ? 'cursor-pointer hover:scale-105 hover:shadow-sm' : ''}
                ${className}
            `}
            style={{
                backgroundColor,
                borderColor,
                color,
            }}
            onClick={onClick}
            title={compact ? name : undefined}
            aria-label={name}
        >
            <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
            ></span>
            {!compact && name}
        </span>
    )
}

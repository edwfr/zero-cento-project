'use client'

interface MovementPatternTagProps {
    name: string
    color?: string
    onClick?: () => void
    className?: string
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
                inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold
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
        >
            <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
            ></span>
            {name}
        </span>
    )
}

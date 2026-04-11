'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import MovementPatternTag from './MovementPatternTag'
import { getApiErrorMessage } from '@/lib/api-error'

interface MovementPattern {
    id: string
    name: string
}

interface MovementPatternColor {
    movementPatternId: string
    color: string
}

interface ColorConfig {
    [movementPatternId: string]: string
}

const PRIMARY_COLOR = '#FFA700' // Brand primary color - default for all patterns
const PRESET_COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
]

export default function MovementPatternColorsSection() {
    const { t } = useTranslation(['admin', 'common'])
    const [movementPatterns, setMovementPatterns] = useState<MovementPattern[]>([])
    const [colorConfig, setColorConfig] = useState<ColorConfig>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        setError(null)

        try {
            // Load movement patterns
            const patternsRes = await fetch('/api/movement-patterns')
            if (!patternsRes.ok) {
                throw new Error(t('admin:movementPatterns.loadError'))
            }
            const patternsData = await patternsRes.json()
            const patterns = patternsData.data.items.map((p: any) => ({
                id: p.id,
                name: p.name,
            }))
            setMovementPatterns(patterns)

            // Load existing colors
            const colorsRes = await fetch('/api/movement-pattern-colors')
            if (!colorsRes.ok) {
                throw new Error(t('admin:colors.loadError'))
            }
            const colorsData = await colorsRes.json()

            // Build color config from existing data
            const config: ColorConfig = {}
            colorsData.data.items.forEach((item: any) => {
                config[item.movementPatternId] = item.color
            })

            // Assign primary color as default to patterns without custom colors
            patterns.forEach((pattern: MovementPattern) => {
                if (!config[pattern.id]) {
                    config[pattern.id] = PRIMARY_COLOR
                }
            })

            setColorConfig(config)
        } catch (err: any) {
            setError(err.message || t('common:errors.loadingError'))
        } finally {
            setLoading(false)
        }
    }

    const handleColorChange = (movementPatternId: string, color: string) => {
        setColorConfig((prev) => ({
            ...prev,
            [movementPatternId]: color,
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        setError(null)
        setSuccess(false)

        try {
            const updates = Object.entries(colorConfig).map(([movementPatternId, color]) => ({
                movementPatternId,
                color,
            }))

            const res = await fetch('/api/movement-pattern-colors', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(getApiErrorMessage(errorData, t('admin:colors.saveFailed'), t))
            }

            setSuccess(true)
            setIsEditing(false)

            // Reset success message after 3 seconds
            setTimeout(() => {
                setSuccess(false)
            }, 3000)
        } catch (err: any) {
            setError(err.message || t('admin:colors.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        loadData()
        setIsEditing(false)
        setError(null)
        setSuccess(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            </div>
        )
    }

    if (!isEditing) {
        return (
            <div>
                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-4">
                        {t('admin:colors.description')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {movementPatterns.map((pattern) => (
                            <div
                                key={pattern.id}
                                className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-8 h-8 rounded-md border-2 border-gray-300 flex-shrink-0"
                                        style={{ backgroundColor: colorConfig[pattern.id] }}
                                    ></div>
                                    <span className="text-sm font-medium text-gray-900">{pattern.name}</span>
                                </div>
                                <MovementPatternTag
                                    name={pattern.name}
                                    color={colorConfig[pattern.id]}
                                />
                            </div>
                        ))}
                    </div>
                </div>
                <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors"
                >
                    {t('admin:colors.edit')}
                </button>
            </div>
        )
    }

    return (
        <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('admin:colors.editTitle')}
            </h3>

            {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-sm text-green-600 font-medium">{t('admin:colors.saveSuccess')}</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            <div className="space-y-3 mb-6">
                {movementPatterns.map((pattern) => (
                    <div key={pattern.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start gap-4">
                            <input
                                type="color"
                                value={colorConfig[pattern.id] || PRIMARY_COLOR}
                                onChange={(e) => handleColorChange(pattern.id, e.target.value)}
                                disabled={saving}
                                className="w-12 h-12 rounded-md border-2 border-gray-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <div className="flex-1 space-y-3">
                                <div>
                                    <span className="text-sm font-medium text-gray-900">{pattern.name}</span>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {colorConfig[pattern.id] || PRIMARY_COLOR}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => handleColorChange(pattern.id, color)}
                                            disabled={saving}
                                            className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="text-xs font-medium text-gray-600">{t('admin:colors.preview')}</span>
                                <MovementPatternTag
                                    name={pattern.name}
                                    color={colorConfig[pattern.id] || PRIMARY_COLOR}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {saving ? t('common:common.saving') : t('admin:colors.save')}
                </button>
                <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:cursor-not-allowed"
                >
                    {t('common:common.cancel')}
                </button>
            </div>
        </div>
    )
}

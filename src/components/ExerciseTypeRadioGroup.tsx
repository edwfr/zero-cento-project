'use client'

import { useTranslation } from 'react-i18next'
import { EXERCISE_TYPES, EXERCISE_TYPE_META, type ExerciseType } from '@/lib/exercise-type'

interface ExerciseTypeRadioGroupProps {
    value: ExerciseType
    onChange: (type: ExerciseType) => void
    disabled?: boolean
    name?: string
}

export default function ExerciseTypeRadioGroup({
    value,
    onChange,
    disabled = false,
    name = 'exerciseType',
}: ExerciseTypeRadioGroupProps) {
    const { t } = useTranslation(['trainer', 'common'])

    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
            {EXERCISE_TYPES.map((type) => (
                <label key={type} className="flex items-center">
                    <input
                        type="radio"
                        name={name}
                        value={type}
                        checked={value === type}
                        onChange={() => onChange(type)}
                        disabled={disabled}
                        className="mr-2 disabled:cursor-not-allowed"
                    />
                    <span>{t(EXERCISE_TYPE_META[type].formLabelKey)}</span>
                </label>
            ))}
        </div>
    )
}

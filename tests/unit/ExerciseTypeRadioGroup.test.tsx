import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExerciseTypeRadioGroup from '@/components/ExerciseTypeRadioGroup'

describe('ExerciseTypeRadioGroup', () => {
    it('renders one radio per type with form labels', () => {
        render(<ExerciseTypeRadioGroup value="accessory" onChange={vi.fn()} />)
        expect(screen.getAllByRole('radio')).toHaveLength(3)
        expect(screen.getByLabelText('trainer:exercises.fundamentalSBD')).not.toBeChecked()
        expect(screen.getByLabelText('common:exerciseTypes.accessory.label')).toBeChecked()
        expect(screen.getByLabelText('common:exerciseTypes.postural.label')).toBeInTheDocument()
    })

    it('calls onChange with the selected type', () => {
        const onChange = vi.fn()
        render(<ExerciseTypeRadioGroup value="accessory" onChange={onChange} />)
        fireEvent.click(screen.getByLabelText('common:exerciseTypes.postural.label'))
        expect(onChange).toHaveBeenCalledWith('postural')
    })

    it('disables all radios when disabled', () => {
        render(<ExerciseTypeRadioGroup value="accessory" onChange={vi.fn()} disabled />)
        screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled())
    })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AutocompleteSearch from '@/components/AutocompleteSearch'

const options = [
    { id: '1', label: 'Squat' },
    { id: '2', label: 'Bench Press' },
]

describe('AutocompleteSearch', () => {
    it('forwards tabIndex to the internal input', () => {
        render(
            <AutocompleteSearch
                options={options}
                onSelect={vi.fn()}
                tabIndex={-1}
            />
        )
        const input = screen.getByRole('combobox')
        expect(input).toHaveAttribute('tabIndex', '-1')
    })

    it('leaves tabIndex unset when not provided', () => {
        render(
            <AutocompleteSearch
                options={options}
                onSelect={vi.fn()}
            />
        )
        const input = screen.getByRole('combobox')
        // When tabIndex is undefined, Input doesn't set the attribute
        // so it won't have a tabIndex attribute
        expect(input).not.toHaveAttribute('tabIndex', '-1')
    })

    it('renders with correct placeholder', () => {
        render(
            <AutocompleteSearch
                options={options}
                onSelect={vi.fn()}
                placeholder="Search exercises"
            />
        )
        const input = screen.getByRole('combobox')
        expect(input).toHaveAttribute('placeholder', 'Search exercises')
    })
})

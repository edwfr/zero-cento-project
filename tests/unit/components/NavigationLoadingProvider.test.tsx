import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
    NavigationLoadingProvider,
    useNavigationLoader,
} from '@/components/NavigationLoadingProvider'

function Probe() {
    const { start, stop, isLoading } = useNavigationLoader()
    return (
        <div>
            <span data-testid="state">{isLoading ? 'on' : 'off'}</span>
            <button onClick={() => start()}>start</button>
            <button onClick={() => stop()}>stop</button>
        </div>
    )
}

describe('NavigationLoadingProvider', () => {
    it('toggles overlay via start/stop', () => {
        render(
            <NavigationLoadingProvider>
                <Probe />
            </NavigationLoadingProvider>
        )

        expect(screen.getByTestId('state').textContent).toBe('off')

        act(() => {
            screen.getByText('start').click()
        })
        expect(screen.getByTestId('state').textContent).toBe('on')
        expect(screen.getByRole('status')).toBeInTheDocument()

        act(() => {
            screen.getByText('stop').click()
        })
        expect(screen.getByTestId('state').textContent).toBe('off')
    })

    it('throws when used outside provider', () => {
        const Bad = () => {
            useNavigationLoader()
            return null
        }
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect(() => render(<Bad />)).toThrow(/NavigationLoadingProvider/)
        spy.mockRestore()
    })
})

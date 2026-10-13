import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import WeekTypeBanner from '@/components/WeekTypeBanner'

describe('WeekTypeBanner', () => {
    it('renders week and day on one line separated by a middle dot', () => {
        render(<WeekTypeBanner weekType="volume" weekNumber={1} dayNumber={2} />)

        const label = 'components:weekTypeBanner.week 1 · components:weekTypeBanner.day 2'
        expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })

    it('omits the day when dayNumber is missing', () => {
        render(<WeekTypeBanner weekType="volume" weekNumber={3} />)

        expect(screen.getAllByText('components:weekTypeBanner.week 3').length).toBeGreaterThan(0)
    })

    it('shows completed sets, total sets and percentage next to the bar', () => {
        render(
            <WeekTypeBanner
                weekType="volume"
                weekNumber={1}
                dayNumber={1}
                progressPercentage={50}
                completedSets={6}
                totalSets={12}
            />
        )

        expect(screen.getByText('6/12 components:weekTypeBanner.sets · 50%')).toBeInTheDocument()
    })

    it('falls back to the percentage alone when set counts are not provided', () => {
        render(<WeekTypeBanner weekType="volume" weekNumber={1} progressPercentage={36} />)

        expect(screen.getAllByText('36%')).toHaveLength(2)
        expect(screen.queryByText(/components:weekTypeBanner\.sets/)).not.toBeInTheDocument()
    })

    it('falls back to the percentage alone when there are no planned sets', () => {
        render(
            <WeekTypeBanner
                weekType="volume"
                weekNumber={1}
                progressPercentage={0}
                completedSets={0}
                totalSets={0}
            />
        )

        expect(screen.getAllByText('0%')).toHaveLength(2)
        expect(screen.queryByText(/components:weekTypeBanner\.sets/)).not.toBeInTheDocument()
    })

    it('labels the progress bars with the translated progress label', () => {
        render(<WeekTypeBanner weekType="volume" weekNumber={1} progressPercentage={50} />)

        const bars = screen.getAllByRole('progressbar', { name: 'components:weekTypeBanner.progress' })
        expect(bars).toHaveLength(2)
    })

    it('renders no progress bar when progressPercentage is undefined', () => {
        render(<WeekTypeBanner weekType="volume" weekNumber={1} />)

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })
})

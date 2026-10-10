import { describe, it, expect } from 'vitest'
import { traineeDetailHref } from '@/lib/trainee-detail-href'

describe('traineeDetailHref', () => {
    it('opens the default view when no tab is asked for', () => {
        expect(traineeDetailHref('t1')).toBe('/trainer/trainees/t1')
    })

    it('opens a named tab', () => {
        expect(traineeDetailHref('t1', 'programs')).toBe('/trainer/trainees/t1?tab=programs')
        expect(traineeDetailHref('t1', 'records')).toBe('/trainer/trainees/t1?tab=records')
    })

    it('escapes the id', () => {
        expect(traineeDetailHref('a/b', 'programs')).toBe('/trainer/trainees/a%2Fb?tab=programs')
    })
})

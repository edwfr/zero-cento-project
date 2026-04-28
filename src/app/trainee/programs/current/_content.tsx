'use client'

import ProgramDetailContent from '../_components/ProgramDetailContent'
import type { TraineeProgramView } from '@/lib/trainee-program-data'

interface CurrentProgramContentProps {
    initialData: TraineeProgramView
}

export default function CurrentProgramContent({ initialData }: CurrentProgramContentProps) {
    return <ProgramDetailContent mode="current" initialData={initialData} />
}

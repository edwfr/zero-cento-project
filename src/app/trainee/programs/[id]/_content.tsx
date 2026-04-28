'use client'

import ProgramDetailContent from '../_components/ProgramDetailContent'
import type { TraineeProgramView } from '@/lib/trainee-program-data'

interface ProgramDetailByIdContentProps {
    initialData: TraineeProgramView
}

export default function ProgramDetailByIdContent({ initialData }: ProgramDetailByIdContentProps) {
    return <ProgramDetailContent mode="history" initialData={initialData} />
}

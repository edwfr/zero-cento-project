'use client'

import ProgramDetailContent from '../_components/ProgramDetailContent'

interface ProgramDetailByIdContentProps {
    programId: string
}

export default function ProgramDetailByIdContent({ programId }: ProgramDetailByIdContentProps) {
    return <ProgramDetailContent mode="history" programId={programId} />
}

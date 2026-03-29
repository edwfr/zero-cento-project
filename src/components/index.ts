/**
 * Zero Cento Training Platform - Shared UI Components
 * Barrel export for easy importing
 */

// Form Components
export { default as WeightTypeSelector } from './WeightTypeSelector'
export { default as RPESelector } from './RPESelector'
export { default as RestTimeSelector } from './RestTimeSelector'
export { default as RepsInput } from './RepsInput'
export { default as FeedbackForm } from './FeedbackForm'

// Display Components
export { default as ExerciseCard } from './ExerciseCard'
export { default as MovementPatternTag } from './MovementPatternTag'
export { default as YoutubeEmbed } from './YoutubeEmbed'
export { default as WeekTypeBanner } from './WeekTypeBanner'
export { default as ProgressBar } from './ProgressBar'
export { default as StatCard } from './StatCard'
export { default as NavigationCard } from './NavigationCard'

// Loading & Feedback
export { default as LoadingSpinner, FullPageLoader, InlineLoader } from './LoadingSpinner'
export { default as ToastNotification, ToastProvider, useToast } from './ToastNotification'
export { default as ConfirmationModal } from './ConfirmationModal'
export { default as ErrorBoundary } from './ErrorBoundary'
export { default as RoleGuard } from './RoleGuard'

// Tables
export { default as ProgramsTable } from './ProgramsTable'

// Layout Components (existing)
export { default as DashboardLayout } from './DashboardLayout'
export { default as ProfileForm } from './ProfileForm'

// User Management Components (existing)
export { default as UsersTable } from './UsersTable'
export { default as UserCreateModal } from './UserCreateModal'
export { default as UserEditModal } from './UserEditModal'
export { default as UserDeleteModal } from './UserDeleteModal'

// Exercise Management Components (existing)
export { default as ExercisesTable } from './ExercisesTable'
export { default as ExerciseCreateModal } from './ExerciseCreateModal'

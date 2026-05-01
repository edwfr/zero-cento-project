/**
 * Zero Cento Training Platform - Shared UI Components
 * Barrel export for easy importing
 */

// Design System Base Components
export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'
export { Input } from './Input'
export type { InputProps, InputSize, InputState } from './Input'
export { Textarea } from './Textarea'
export type { TextareaProps, TextareaState } from './Textarea'
export { FormLabel } from './FormLabel'
export type { FormLabelProps } from './FormLabel'
export { Card } from './Card'
export type { CardProps, CardVariant } from './Card'

// Action Buttons
export { ActionIconButton, InlineActions } from './ActionIconButton'
export type { ActionIconButtonProps, ActionVariant } from './ActionIconButton'

// Form Components
export { default as RPESelector } from './RPESelector'
export { default as FeedbackForm } from './FeedbackForm'
export { default as DatePicker } from './DatePicker'
export { default as AutocompleteSearch } from './AutocompleteSearch'
export type { AutocompleteOption } from './AutocompleteSearch'

// Display Components
export { default as ExerciseCard } from './ExerciseCard'
export { default as MovementPatternTag } from './MovementPatternTag'
export { default as YoutubeEmbed } from './YoutubeEmbed'
export { default as WeekTypeBadge } from './WeekTypeBadge'
export { default as WeekTypeBanner } from './WeekTypeBanner'
export { default as ProgressBar } from './ProgressBar'
export { default as StatCard } from './StatCard'
export { default as NavigationCard } from './NavigationCard'
export { default as RPEOneRMTable } from './RPEOneRMTable'
export { default as PersonalRecordsExplorer } from './PersonalRecordsExplorer'

// Loading & Feedback
export { default as LoadingSpinner, FullPageLoader, InlineLoader } from './LoadingSpinner'
export { default as NavigationLoadingOverlay } from './NavigationLoadingOverlay'
export {
    NavigationLoadingProvider,
    useNavigationLoader,
} from './NavigationLoadingProvider'
export {
    default as Skeleton,
    SkeletonText,
    SkeletonCard,
    SkeletonTable,
    SkeletonList,
    SkeletonDashboard,
    SkeletonForm,
    SkeletonNavigation,
    SkeletonDetail,
} from './Skeleton'
export { default as ToastNotification, ToastProvider, useToast } from './ToastNotification'
export { default as ConfirmationModal } from './ConfirmationModal'
export { default as ErrorBoundary } from './ErrorBoundary'
export { default as RoleGuard } from './RoleGuard'

// Tables
export { default as ProgramsTable } from './ProgramsTable'

// Layout Components (existing)
export { default as DashboardLayout } from './DashboardLayout'
export { default as ProfileForm } from './ProfileForm'

// Profile Components
export { default as MovementPatternColorsSection } from './MovementPatternColorsSection'

// User Management Components (existing)
export { default as UsersTable } from './UsersTable'
export { default as UserCreateModal } from './UserCreateModal'
export { default as UserEditModal } from './UserEditModal'
export { default as UserDeleteModal } from './UserDeleteModal'

// Exercise Management Components (existing)
export { default as ExercisesTable } from './ExercisesTable'
export { default as ExerciseCreateModal } from './ExerciseCreateModal'
export { default as WorkoutRecapPanel } from './WorkoutRecapPanel'

import { z } from 'zod'

/**
 * User Validation Schemas
 */

export const passwordSchema = z
    .string()
    .min(8, 'validation.passwordMinLength')
    .regex(/[A-Z]/, 'validation.passwordUppercase')
    .regex(/[a-z]/, 'validation.passwordLowercase')
    .regex(/[0-9]/, 'validation.passwordNumber')

export const createUserSchema = z.object({
    email: z.string().email('validation.invalidEmail'),
    firstName: z.string().min(2, 'validation.firstNameTooShort').max(50, 'validation.firstNameTooLong'),
    lastName: z.string().min(2, 'validation.lastNameTooShort').max(50, 'validation.lastNameTooLong'),
    role: z.enum(['admin', 'trainer', 'trainee']),
    password: passwordSchema.optional(), // Optional for admin-created users
})

export const updateUserSchema = z.object({
    email: z.string().email('Email non valida').optional(),
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    isActive: z.boolean().optional(),
})

export const loginSchema = z.object({
    email: z.string().email('validation.invalidEmail'),
    password: z.string().min(1, 'validation.passwordRequired'),
})

export const resetPasswordSchema = z.object({
    email: z.string().email('validation.invalidEmail'),
})

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'validation.currentPasswordRequired'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'validation.passwordMismatch',
    path: ['confirmPassword'],
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

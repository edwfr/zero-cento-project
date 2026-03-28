import { z } from 'zod'

/**
 * User Validation Schemas
 */

export const passwordSchema = z
  .string()
  .min(8, 'Password minimo 8 caratteri')
  .regex(/[A-Z]/, 'Almeno una lettera maiuscola')
  .regex(/[a-z]/, 'Almeno una lettera minuscola')
  .regex(/[0-9]/, 'Almeno un numero')

export const createUserSchema = z.object({
  email: z.string().email('Email non valida'),
  firstName: z.string().min(2, 'Nome troppo corto').max(50, 'Nome troppo lungo'),
  lastName: z.string().min(2, 'Cognome troppo corto').max(50, 'Cognome troppo lungo'),
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
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password richiesta'),
})

export const resetPasswordSchema = z.object({
  email: z.string().email('Email non valida'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password attuale richiesta'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Le password non corrispondono',
  path: ['confirmPassword'],
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

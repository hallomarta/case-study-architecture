import { z } from 'zod';
import { passwordSchema, emailSchema } from './generic-schemas';

export const forgotPasswordSchema = z
    .object({
        email: emailSchema,
    })
    .strict()
    .meta({
        id: 'ForgotPasswordRequest',
        description: 'Password reset request',
    });

export const resetPasswordSchema = z
    .object({
        token: z.string().min(1, 'Token is required').meta({
            description: 'Password reset token from email',
            example: 'abc123xyz789',
        }),
        newPassword: passwordSchema,
    })
    .strict()
    .meta({
        id: 'ResetPasswordRequest',
        description: 'Password reset data',
    });

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

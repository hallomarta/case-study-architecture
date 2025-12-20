import { z } from 'zod';

/**
 * Shared validation schemas for use across controllers.
 * Centralizes validation rules to ensure consistency.
 */

/**
 * Password validation schema.
 * Requirements:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 */
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .refine(val => /[a-z]/.test(val), {
        message: 'Password must contain at least one lowercase letter',
    })
    .refine(val => /[A-Z]/.test(val), {
        message: 'Password must contain at least one uppercase letter',
    })
    .refine(val => /\d/.test(val), {
        message: 'Password must contain at least one number',
    });

/**
 * Email validation schema.
 */
export const emailSchema = z.string().email('Invalid email format');

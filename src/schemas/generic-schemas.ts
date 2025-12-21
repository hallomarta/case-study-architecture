import { z } from 'zod';

/**
 * Generic validation schemas and response schemas used across the API
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
    })
    .meta({
        description:
            'Password (min 8 chars, must contain lowercase, uppercase, and number)',
        example: 'MyP@ssw0rd',
    });

/**
 * Email validation schema.
 */
export const emailSchema = z.string().email('Invalid email format').meta({
    description: 'Email address',
    example: 'user@example.com',
});

/**
 * Generic response schemas
 */

// Success message schema
export const successMessageSchema = z
    .object({
        message: z.string(),
    })
    .meta({
        id: 'SuccessMessage',
        description: 'Success message',
        example: {
            message: 'Operation completed successfully',
        },
    });

// Error response schema
export const errorResponseSchema = z
    .object({
        message: z.string(),
        error: z.string().optional(),
        statusCode: z.number().optional(),
    })
    .meta({
        id: 'ErrorResponse',
        description: 'Error response',
        example: {
            message: 'An error occurred',
            error: 'bad_request',
            statusCode: 400,
        },
    });

// Validation error response schema
export const validationErrorResponseSchema = z
    .object({
        message: z.string(),
        errors: z.array(
            z.object({
                path: z.array(z.union([z.string(), z.number()])),
                message: z.string(),
            })
        ),
    })
    .meta({
        id: 'ValidationErrorResponse',
        description: 'Validation error response',
        example: {
            message: 'Validation failed',
            errors: [
                {
                    path: ['email'],
                    message: 'Invalid email format',
                },
            ],
        },
    });

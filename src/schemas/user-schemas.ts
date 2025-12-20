import { z } from 'zod';
import { passwordSchema, emailSchema } from './generic-schemas';

/**
 * User response schema
 */
export const userSchema = z
    .object({
        id: z.string().uuid(),
        email: z.string().email(),
        firstName: z.string(),
        lastName: z.string(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    })
    .meta({
        id: 'User',
        description: 'User object',
        example: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
        },
    });

/**
 * User request schemas
 */
export const registerSchema = z
    .object({
        email: emailSchema,
        password: passwordSchema,
        firstName: z
            .string()
            .min(1, 'First name is required')
            .meta({ example: 'John' }),
        lastName: z
            .string()
            .min(1, 'Last name is required')
            .meta({ example: 'Doe' }),
    })
    .strict()
    .meta({
        id: 'RegisterRequest',
        description: 'User registration data',
    });

export const updateProfileSchema = z
    .object({
        firstName: z
            .string()
            .min(1, 'First name cannot be empty')
            .optional()
            .meta({ example: 'Jane' }),
        lastName: z
            .string()
            .min(1, 'Last name cannot be empty')
            .optional()
            .meta({ example: 'Smith' }),
    })
    .strict()
    .refine(
        data => {
            // Reject if firstName is provided but empty
            if ('firstName' in data && data.firstName === '') {
                return false;
            }
            // Reject if lastName is provided but empty
            if ('lastName' in data && data.lastName === '') {
                return false;
            }
            return true;
        },
        { message: 'Fields cannot be empty strings' }
    )
    .meta({
        id: 'UpdateProfileRequest',
        description: 'User profile update data (at least one field required)',
    });

export type RegisterDto = z.infer<typeof registerSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

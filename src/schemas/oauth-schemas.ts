import { z } from 'zod';
import { emailSchema } from './generic-schemas';

/**
 * OAuth response schemas
 */

// Token response schema (OAuth 2.0 / OIDC)
export const tokenResponseSchema = z
    .object({
        access_token: z.string(),
        token_type: z.literal('Bearer'),
        expires_in: z.number(),
        refresh_token: z.string(),
        id_token: z.string(),
    })
    .meta({
        id: 'TokenResponse',
        description: 'OAuth 2.0 token response',
        example: {
            access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            token_type: 'Bearer',
            expires_in: 3600,
            refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            id_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
    });

// UserInfo response schema (OIDC standard claims)
export const userInfoSchema = z
    .object({
        sub: z.string().uuid(),
        email: z.string().email(),
        given_name: z.string(),
        family_name: z.string(),
    })
    .meta({
        id: 'UserInfo',
        description: 'OIDC UserInfo claims',
        example: {
            sub: '123e4567-e89b-12d3-a456-426614174000',
            email: 'user@example.com',
            given_name: 'John',
            family_name: 'Doe',
        },
    });

/**
 * OAuth request schemas
 */

export const tokenRequestSchema = z
    .object({
        grant_type: z.enum(['password', 'refresh_token']).meta({
            description: 'The OAuth 2.0 grant type',
            example: 'password',
        }),
        // For password grant
        username: emailSchema.optional(),
        password: z.string().min(1).optional().meta({
            description: 'User password (required for password grant)',
            example: 'MyP@ssw0rd',
        }),
        // For refresh_token grant
        refresh_token: z.string().min(1).optional().meta({
            description: 'Refresh token (required for refresh_token grant)',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        }),
    })
    .strict()
    .refine(
        data => {
            if (data.grant_type === 'password') {
                return data.username && data.password;
            }
            if (data.grant_type === 'refresh_token') {
                return data.refresh_token;
            }
            return false;
        },
        {
            message:
                'password grant requires username and password; refresh_token grant requires refresh_token',
        }
    )
    .meta({
        id: 'TokenRequest',
        description: 'OAuth 2.0 token request',
    });

export const revokeRequestSchema = z
    .object({
        refresh_token: z.string().min(1, 'Refresh token is required').meta({
            description: 'The refresh token to revoke',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        }),
    })
    .strict()
    .meta({
        id: 'RevokeRequest',
        description: 'Token revocation request',
    });

export type TokenRequestDto = z.infer<typeof tokenRequestSchema>;
export type RevokeRequestDto = z.infer<typeof revokeRequestSchema>;

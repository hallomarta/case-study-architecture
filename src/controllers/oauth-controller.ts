import { inject } from 'inversify';
import {
    Controller,
    Get,
    Post,
    Body,
    UseGuard,
    Request,
    ApplyMiddleware,
    BadRequestHttpResponse,
} from '@inversifyjs/http-core';
import { ValidateStandardSchemaV1 } from '@inversifyjs/standard-schema-validation';
import { z } from 'zod';
import type { Request as ExpressRequest } from 'express';
import { TOKEN } from '../lib/tokens';
import { getUser } from '../lib/request-utils';
import { AuthGuard } from '../guards/auth-guard';
import { LoginRateLimitMiddleware } from '../middleware/rate-limit-middleware';
import type { TokenResponse } from '../services/token-service';
import type { SessionService } from '../services/session-service';
import type { UserService } from '../services/user-service';
import type { OAuthService } from '../services/oauth-service';
import { emailSchema } from '../lib/validation-schemas';

// OAuth 2.0 token request schema
const tokenRequestSchema = z
    .object({
        grant_type: z.enum(['password', 'refresh_token']),
        // For password grant
        username: emailSchema.optional(),
        password: z.string().min(1).optional(),
        // For refresh_token grant
        refresh_token: z.string().min(1).optional(),
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
    );

const revokeRequestSchema = z
    .object({
        refresh_token: z.string().min(1, 'Refresh token is required'),
    })
    .strict();

type TokenRequestDto = z.infer<typeof tokenRequestSchema>;
type RevokeRequestDto = z.infer<typeof revokeRequestSchema>;

/**
 * OAuth Controller - OIDC-style authentication endpoints
 *
 * Implements OAuth 2.0 / OIDC conventions:
 * - POST /oauth/token - Unified token endpoint (login + refresh)
 * - POST /oauth/revoke - Token revocation (logout)
 * - POST /oauth/revoke-all - Revoke all sessions (custom extension)
 * - GET /oauth/userinfo - Get authenticated user claims
 */
@Controller('/oauth')
export class OAuthController {
    constructor(
        @inject(TOKEN.OAuthService) private oauthService: OAuthService,
        @inject(TOKEN.SessionService) private sessionService: SessionService,
        @inject(TOKEN.UserService) private userService: UserService
    ) {}

    /**
     * OAuth 2.0 Token Endpoint
     *
     * Supports two grant types:
     * - password: Login with email/password (username + password params)
     * - refresh_token: Refresh access token (refresh_token param)
     *
     * Returns OIDC-style token response with access_token, refresh_token, id_token
     */
    @Post('/token')
    @ApplyMiddleware(LoginRateLimitMiddleware)
    async token(
        @Body()
        @ValidateStandardSchemaV1(tokenRequestSchema)
        data: TokenRequestDto
    ): Promise<TokenResponse> {
        if (data.grant_type === 'password') {
            return this.oauthService.handlePasswordGrant(
                data.username!,
                data.password!
            );
        }

        if (data.grant_type === 'refresh_token') {
            return this.oauthService.handleRefreshTokenGrant(
                data.refresh_token!
            );
        }

        throw new BadRequestHttpResponse(
            { message: 'Unsupported grant type' },
            'Unsupported grant type'
        );
    }

    /**
     * Token Revocation Endpoint (RFC 7009)
     *
     * Revokes the specified refresh token (logout current session)
     */
    @Post('/revoke')
    @UseGuard(AuthGuard)
    async revoke(
        @Body()
        @ValidateStandardSchemaV1(revokeRequestSchema)
        data: RevokeRequestDto,
        @Request() request: ExpressRequest
    ) {
        const userId = getUser(request).id;
        await this.sessionService.revokeSession(userId, data.refresh_token);
        return { message: 'Token revoked successfully' };
    }

    /**
     * Revoke All Sessions (custom extension)
     *
     * Revokes all refresh tokens for the authenticated user (logout all devices)
     */
    @Post('/revoke-all')
    @UseGuard(AuthGuard)
    async revokeAll(@Request() request: ExpressRequest) {
        const userId = getUser(request).id;
        await this.sessionService.revokeAllSessions(userId);
        return { message: 'All sessions revoked successfully' };
    }

    /**
     * UserInfo Endpoint (OIDC standard)
     *
     * Returns claims about the authenticated user.
     * Uses OIDC standard claim names: sub, email, given_name, family_name
     */
    @Get('/userinfo')
    @UseGuard(AuthGuard)
    async userinfo(@Request() request: ExpressRequest) {
        const userId = getUser(request).id;
        const user = await this.userService.findById(userId);

        if (!user) {
            throw new BadRequestHttpResponse(
                { message: 'User not found' },
                'User not found'
            );
        }

        // Return OIDC standard claims
        return {
            sub: user.id,
            email: user.email,
            given_name: user.firstName,
            family_name: user.lastName,
        };
    }
}

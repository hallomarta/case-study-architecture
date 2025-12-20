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
    HttpStatusCode,
} from '@inversifyjs/http-core';
import {
    OasServer,
    OasSummary,
    OasDescription,
    OasOperationId,
    OasTag,
    OasRequestBody,
    OasResponse,
    OasSecurity,
} from '@inversifyjs/http-open-api';
import { ValidateStandardSchemaV1 } from '@inversifyjs/standard-schema-validation';
import type { Request as ExpressRequest } from 'express';
import { TOKEN } from '../lib/tokens';
import { getUser } from '../lib/request-utils';
import { AuthGuard } from '../guards/auth-guard';
import { LoginRateLimitMiddleware } from '../middleware/rate-limit-middleware';
import type { TokenResponse } from '../services/token-service';
import type { SessionService } from '../services/session-service';
import type { UserService } from '../services/user-service';
import type { OAuthService } from '../services/oauth-service';
import { zodToOpenApi } from '../lib/openapi';
import {
    tokenRequestSchema,
    revokeRequestSchema,
    tokenResponseSchema,
    userInfoSchema,
    type TokenRequestDto,
    type RevokeRequestDto,
} from '../schemas/oauth-schemas';
import {
    successMessageSchema,
    errorResponseSchema,
    validationErrorResponseSchema,
} from '../schemas/generic-schemas';

/**
 * OAuth Controller - OIDC-style authentication endpoints
 *
 * Implements OAuth 2.0 / OIDC conventions:
 * - POST /oauth/token - Unified token endpoint (login + refresh)
 * - POST /oauth/revoke - Token revocation (logout)
 * - POST /oauth/revoke-all - Revoke all sessions (custom extension)
 * - GET /oauth/userinfo - Get authenticated user claims
 */
@OasServer({
    description: 'Development server',
    url: 'http://localhost:3000',
})
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
    @OasSummary('OAuth 2.0 token endpoint')
    @OasDescription(
        'Authenticate with password grant or refresh access token with refresh_token grant'
    )
    @OasOperationId('getToken')
    @OasTag('oauth')
    @OasTag('authentication')
    @OasRequestBody({
        content: {
            'application/json': {
                schema: zodToOpenApi(tokenRequestSchema),
            },
        },
        description:
            'OAuth 2.0 token request (password or refresh_token grant)',
        required: true,
    })
    @OasResponse(HttpStatusCode.OK, {
        content: {
            'application/json': {
                schema: zodToOpenApi(tokenResponseSchema),
            },
        },
        description: 'Token issued successfully',
    })
    @OasResponse(HttpStatusCode.BAD_REQUEST, {
        content: {
            'application/json': {
                schema: zodToOpenApi(validationErrorResponseSchema),
            },
        },
        description: 'Validation error or unsupported grant type',
    })
    @OasResponse(HttpStatusCode.UNAUTHORIZED, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'Invalid credentials or refresh token',
    })
    @OasResponse(HttpStatusCode.TOO_MANY_REQUESTS, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'Rate limit exceeded',
    })
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
    @OasSummary('Logout: Revoke refresh token')
    @OasDescription(
        'Revokes the specified refresh token (logout current session)'
    )
    @OasOperationId('revokeToken')
    @OasTag('oauth')
    @OasSecurity({
        bearerAuth: [],
    })
    @OasRequestBody({
        content: {
            'application/json': {
                schema: zodToOpenApi(revokeRequestSchema),
            },
        },
        description: 'Token to revoke',
        required: true,
    })
    @OasResponse(HttpStatusCode.OK, {
        content: {
            'application/json': {
                schema: zodToOpenApi(successMessageSchema),
            },
        },
        description: 'Token revoked successfully',
    })
    @OasResponse(HttpStatusCode.UNAUTHORIZED, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'Not authenticated',
    })
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
    @OasSummary('Logout from all devices: Revoke all sessions')
    @OasDescription(
        'Revokes all refresh tokens for the authenticated user (logout all devices)'
    )
    @OasOperationId('revokeAllSessions')
    @OasTag('oauth')
    @OasSecurity({
        bearerAuth: [],
    })
    @OasResponse(HttpStatusCode.OK, {
        content: {
            'application/json': {
                schema: zodToOpenApi(successMessageSchema),
            },
        },
        description: 'All sessions revoked successfully',
    })
    @OasResponse(HttpStatusCode.UNAUTHORIZED, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'Not authenticated',
    })
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
    @OasSummary('Get user info')
    @OasDescription('Returns OIDC standard claims about the authenticated user')
    @OasOperationId('getUserInfo')
    @OasTag('oidc')
    @OasSecurity({
        bearerAuth: [],
    })
    @OasResponse(HttpStatusCode.OK, {
        content: {
            'application/json': {
                schema: zodToOpenApi(userInfoSchema),
            },
        },
        description: 'User info claims',
    })
    @OasResponse(HttpStatusCode.UNAUTHORIZED, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'Not authenticated',
    })
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

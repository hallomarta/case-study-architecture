import { inject, injectable } from 'inversify';
import { BadRequestHttpResponse } from '@inversifyjs/http-core';
import { TOKEN } from '../lib/tokens';
import type { IdentityProvider } from '../providers/identity-provider';
import type { TokenService, TokenResponse } from './token-service';
import type { SessionService } from './session-service';
import type { UserService } from './user-service';

/**
 * OAuth Service
 *
 * Handles OAuth 2.0 grant type flows:
 * - Password grant: Authenticate with email/password
 * - Refresh token grant: Rotate refresh token and issue new tokens
 */
@injectable()
export class OAuthService {
    constructor(
        @inject(TOKEN.IdentityProvider)
        private identityProvider: IdentityProvider,
        @inject(TOKEN.TokenService) private tokenService: TokenService,
        @inject(TOKEN.SessionService) private sessionService: SessionService,
        @inject(TOKEN.UserService) private userService: UserService
    ) {}

    /**
     * Handle Password Grant
     *
     * Authenticates user with email/password and creates a new session
     *
     * @param email - User email
     * @param password - User password
     * @returns TokenResponse with access_token, refresh_token, id_token
     */
    async handlePasswordGrant(
        email: string,
        password: string
    ): Promise<TokenResponse> {
        // Authenticate user via identity provider
        const user = await this.identityProvider.authenticate({
            email,
            password,
        });

        // Create session (generates refresh token, stores in DB)
        const { refreshToken } = await this.sessionService.createSession(
            user.id,
            user.email
        );

        // Generate all tokens and build response
        const { accessToken, idToken } = this.tokenService.generateTokens(user);

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: Math.floor(
                this.tokenService.getRefreshTokenExpiresIn() / 1000
            ),
            refresh_token: refreshToken,
            id_token: idToken,
        };
    }

    /**
     * Handle Refresh Token Grant
     *
     * Validates refresh token, rotates it, and issues new tokens
     *
     * @param refreshToken - Current refresh token
     * @returns TokenResponse with new access_token, refresh_token, id_token
     */
    async handleRefreshTokenGrant(
        refreshToken: string
    ): Promise<TokenResponse> {
        // Rotate session (validates token, handles reuse detection)
        const { newRefreshToken, userId } =
            await this.sessionService.rotateSession(refreshToken);

        // Get user data for token generation
        const user = await this.userService.findById(userId);
        if (!user) {
            throw new BadRequestHttpResponse(
                { message: 'User not found' },
                'User not found'
            );
        }

        // Generate all tokens and build response
        const { accessToken, idToken } = this.tokenService.generateTokens(user);

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: Math.floor(
                this.tokenService.getRefreshTokenExpiresIn() / 1000
            ),
            refresh_token: newRefreshToken,
            id_token: idToken,
        };
    }
}

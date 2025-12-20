import { inject, injectable } from 'inversify';
import { randomUUID } from 'crypto';
import { UnauthorizedHttpResponse } from '@inversifyjs/http-core';
import { TOKEN } from '../lib/tokens';
import { createLogger } from '../lib/logger';
import type { TokenService } from './token-service';
import type { RefreshTokenRepository } from '../repositories/refresh-token-repository';

const logger = createLogger('SessionService');

/**
 * Result of creating a new session
 */
export interface SessionResult {
    refreshToken: string;
    familyId: string;
}

/**
 * Result of rotating a session (refresh token rotation)
 */
export interface RotationResult {
    newRefreshToken: string;
    userId: string;
    email: string;
    familyId: string;
}

export interface SessionService {
    /**
     * Create a new session for a user (login)
     * Returns a new refresh token and family ID
     */
    createSession(userId: string, email: string): Promise<SessionResult>;

    /**
     * Rotate a refresh token (token rotation with reuse detection)
     * Returns new tokens if valid, throws if invalid/reused
     */
    rotateSession(refreshToken: string): Promise<RotationResult>;

    /**
     * Revoke a specific session (logout)
     */
    revokeSession(userId: string, refreshToken: string): Promise<void>;

    /**
     * Revoke all sessions for a user (logout all devices)
     */
    revokeAllSessions(userId: string): Promise<void>;
}

@injectable()
export class SessionServiceImpl implements SessionService {
    constructor(
        @inject(TOKEN.TokenService) private tokenService: TokenService,
        @inject(TOKEN.RefreshTokenRepository)
        private refreshTokenRepository: RefreshTokenRepository
    ) {}

    async createSession(userId: string, email: string): Promise<SessionResult> {
        // Generate refresh token
        const { refreshToken } = this.tokenService.generateTokens({
            id: userId,
            email,
            firstName: '',
            lastName: '',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // Create new token family for this login session
        const familyId = randomUUID();

        // Store refresh token hash in database with family ID
        const expiresAt = new Date(
            Date.now() + this.tokenService.getRefreshTokenExpiresIn()
        );
        await this.refreshTokenRepository.create(
            userId,
            this.tokenService.hashToken(refreshToken),
            familyId,
            expiresAt
        );

        logger.info('Session created', {
            userId,
            familyId,
            event: 'LOGIN',
        });

        return { refreshToken, familyId };
    }

    async rotateSession(refreshToken: string): Promise<RotationResult> {
        // Verify the refresh token JWT
        let payload: { sub: string; email: string };
        try {
            payload = this.tokenService.verifyRefreshToken(refreshToken);
        } catch {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid or expired refresh token' },
                'Invalid or expired refresh token'
            );
        }

        // Check if token exists in database
        const tokenHash = this.tokenService.hashToken(refreshToken);
        const storedToken =
            await this.refreshTokenRepository.findByTokenHash(tokenHash);

        if (!storedToken) {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid or expired refresh token' },
                'Invalid or expired refresh token'
            );
        }

        // SECURITY: Reuse detection - if token is already revoked, someone is trying
        // to reuse an old token. This could indicate token theft. Invalidate entire family.
        if (storedToken.revokedAt) {
            const revokedCount =
                await this.refreshTokenRepository.revokeAllByFamilyId(
                    storedToken.familyId
                );

            logger.error(
                'Refresh token reuse detected - invalidating token family',
                {
                    userId: storedToken.userId,
                    familyId: storedToken.familyId,
                    revokedCount,
                    event: 'TOKEN_REUSE_DETECTED',
                }
            );

            throw new UnauthorizedHttpResponse(
                { message: 'Invalid or expired refresh token' },
                'Invalid or expired refresh token'
            );
        }

        if (storedToken.expiresAt < new Date()) {
            throw new UnauthorizedHttpResponse(
                { message: 'Refresh token has expired' },
                'Refresh token has expired'
            );
        }

        // Revoke old refresh token (rotation)
        await this.refreshTokenRepository.revoke(tokenHash);

        // Generate new refresh token
        const { refreshToken: newRefreshToken } =
            this.tokenService.generateTokens({
                id: payload.sub,
                email: payload.email,
                firstName: '',
                lastName: '',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

        // Store new refresh token with SAME family ID (token rotation within family)
        const expiresAt = new Date(
            Date.now() + this.tokenService.getRefreshTokenExpiresIn()
        );
        await this.refreshTokenRepository.create(
            payload.sub,
            this.tokenService.hashToken(newRefreshToken),
            storedToken.familyId,
            expiresAt
        );

        logger.debug('Session rotated', {
            userId: payload.sub,
            familyId: storedToken.familyId,
            event: 'TOKEN_ROTATED',
        });

        return {
            newRefreshToken,
            userId: payload.sub,
            email: payload.email,
            familyId: storedToken.familyId,
        };
    }

    async revokeSession(userId: string, refreshToken: string): Promise<void> {
        const tokenHash = this.tokenService.hashToken(refreshToken);
        const storedToken =
            await this.refreshTokenRepository.findByTokenHash(tokenHash);

        // Verify token belongs to authenticated user
        if (
            storedToken &&
            storedToken.userId === userId &&
            !storedToken.revokedAt
        ) {
            await this.refreshTokenRepository.revoke(tokenHash);
            logger.debug('Session revoked', { userId, event: 'LOGOUT' });
        }
    }

    async revokeAllSessions(userId: string): Promise<void> {
        await this.refreshTokenRepository.revokeAllForUser(userId);
        logger.info('All sessions revoked', { userId, event: 'LOGOUT_ALL' });
    }
}

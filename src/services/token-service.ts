import { inject, injectable } from 'inversify';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { TOKEN } from '../lib/tokens';
import type { Config } from '../types/Config';
import type { SafeUser } from '../entities/user';

/**
 * OIDC-style token response
 */
export interface TokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    id_token: string;
}

/**
 * JWT payload for access tokens
 */
export interface AccessTokenPayload {
    sub: string;
    email: string;
}

/**
 * JWT payload for refresh tokens
 */
export interface RefreshTokenPayload {
    sub: string;
    email: string;
    jti: string; // Unique token ID
}

/**
 * JWT payload for ID tokens (OIDC standard claims)
 */
export interface IdTokenPayload {
    sub: string;
    email: string;
    given_name: string;
    family_name: string;
    iat: number;
}

export interface TokenService {
    /**
     * Generate all tokens (access, refresh, id_token) for a user
     */
    generateTokens(user: SafeUser): {
        accessToken: string;
        refreshToken: string;
        idToken: string;
    };

    /**
     * Verify and decode an access token
     */
    verifyAccessToken(token: string): AccessTokenPayload;

    /**
     * Verify and decode a refresh token
     */
    verifyRefreshToken(token: string): RefreshTokenPayload;

    /**
     * Hash a token for secure storage (SHA-256)
     */
    hashToken(token: string): string;

    /**
     * Get the configured expiration time for refresh tokens
     */
    getRefreshTokenExpiresIn(): number;

    /**
     * Build a complete TokenResponse object
     */
    buildTokenResponse(user: SafeUser, refreshToken: string): TokenResponse;
}

@injectable()
export class TokenServiceImpl implements TokenService {
    constructor(@inject(TOKEN.Config) private config: Config) {}

    generateTokens(user: SafeUser): {
        accessToken: string;
        refreshToken: string;
        idToken: string;
    } {
        const accessPayload: AccessTokenPayload = {
            sub: user.id,
            email: user.email,
        };

        const refreshPayload: RefreshTokenPayload = {
            sub: user.id,
            email: user.email,
            jti: randomUUID(),
        };

        const idTokenPayload: IdTokenPayload = {
            sub: user.id,
            email: user.email,
            given_name: user.firstName,
            family_name: user.lastName,
            iat: Math.floor(Date.now() / 1000),
        };

        const accessToken = jwt.sign(
            accessPayload,
            this.config.accessTokenSecret,
            {
                expiresIn: Math.floor(this.config.accessTokenExpiresIn / 1000),
                algorithm: 'HS256',
            } as jwt.SignOptions
        );

        const refreshToken = jwt.sign(
            refreshPayload,
            this.config.refreshTokenSecret,
            {
                expiresIn: Math.floor(this.config.refreshTokenExpiresIn / 1000),
                algorithm: 'HS256',
            } as jwt.SignOptions
        );

        // ID token uses the same secret as access token
        const idToken = jwt.sign(
            idTokenPayload,
            this.config.accessTokenSecret,
            {
                expiresIn: Math.floor(this.config.accessTokenExpiresIn / 1000),
                algorithm: 'HS256',
            } as jwt.SignOptions
        );

        return { accessToken, refreshToken, idToken };
    }

    verifyAccessToken(token: string): AccessTokenPayload {
        return jwt.verify(token, this.config.accessTokenSecret, {
            algorithms: ['HS256'],
        }) as AccessTokenPayload;
    }

    verifyRefreshToken(token: string): RefreshTokenPayload {
        return jwt.verify(token, this.config.refreshTokenSecret, {
            algorithms: ['HS256'],
        }) as RefreshTokenPayload;
    }

    hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    getRefreshTokenExpiresIn(): number {
        return this.config.refreshTokenExpiresIn;
    }

    buildTokenResponse(user: SafeUser, refreshToken: string): TokenResponse {
        const { accessToken, idToken } = this.generateTokens(user);

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: Math.floor(this.config.accessTokenExpiresIn / 1000),
            refresh_token: refreshToken,
            id_token: idToken,
        };
    }
}

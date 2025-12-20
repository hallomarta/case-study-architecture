import { inject, injectable } from 'inversify';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import {
    ConflictHttpResponse,
    UnauthorizedHttpResponse,
    NotFoundHttpResponse,
} from '@inversifyjs/http-core';
import { TOKEN } from '../lib/tokens';
import { createLogger } from '../lib/logger';
import type { Config } from '../types/Config';
import type { PasswordManagerService } from './password-manager-service';
import type { UserRepository } from '../repositories/user-repository';
import type { RefreshTokenRepository } from '../repositories/refresh-token-repository';
import type { SafeUser } from '../entities/user';

const logger = createLogger('UserService');

export interface RegisterUserDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface LoginDto {
    email: string;
    password: string;
}

export interface UpdateProfileDto {
    firstName?: string;
    lastName?: string;
}

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
}

export interface UserService {
    register(userData: RegisterUserDto): Promise<SafeUser>;
    authenticate(credentials: LoginDto): Promise<AuthResponse>;
    refreshAccessToken(refreshToken: string): Promise<AuthResponse>;
    logout(userId: string, refreshToken: string): Promise<void>;
    logoutAll(userId: string): Promise<void>;
    getProfile(userId: string): Promise<SafeUser>;
    updateProfile(userId: string, data: UpdateProfileDto): Promise<SafeUser>;
}

@injectable()
export class UserServiceImpl implements UserService {
    constructor(
        @inject(TOKEN.Config) private config: Config,
        @inject(TOKEN.PasswordManagerService)
        private passwordManager: PasswordManagerService,
        @inject(TOKEN.UserRepository) private userRepository: UserRepository,
        @inject(TOKEN.RefreshTokenRepository)
        private refreshTokenRepository: RefreshTokenRepository
    ) { }

    // Helper: Hash refresh token for storage
    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    // Helper: Generate tokens
    private generateTokens(user: { id: string; email: string }): {
        accessToken: string;
        refreshToken: string;
    } {
        const accessPayload = { sub: user.id, email: user.email };
        const refreshPayload = {
            sub: user.id,
            email: user.email,
            jti: randomUUID(), // Unique token ID for each refresh token
        };

        const accessToken = jwt.sign(accessPayload, this.config.accessTokenSecret, {
            expiresIn: Math.floor(this.config.accessTokenExpiresIn / 1000), // Convert ms to seconds
            algorithm: 'HS256',
        } as jwt.SignOptions);

        const refreshToken = jwt.sign(
            refreshPayload,
            this.config.refreshTokenSecret,
            {
                expiresIn: Math.floor(this.config.refreshTokenExpiresIn / 1000), // Convert ms to seconds
                algorithm: 'HS256',
            } as jwt.SignOptions
        );

        return { accessToken, refreshToken };
    }

    async register(userData: RegisterUserDto): Promise<SafeUser> {
        // Check if user already exists (efficient existence check)
        const existingUser = await this.userRepository.findByEmail(
            userData.email
        );
        if (existingUser) {
            throw new ConflictHttpResponse(
                { message: 'User with this email already exists' },
                'User with this email already exists'
            );
        }

        // Hash password
        const hashedPassword = await this.passwordManager.toHash(
            userData.password
        );

        // Create user - returns SafeUser without identities
        const user = await this.userRepository.create({
            ...userData,
            password: hashedPassword,
        });

        return user;
    }

    async authenticate(credentials: LoginDto): Promise<AuthResponse> {
        // SECURITY: Use explicit method to fetch identity data for authentication
        const user = await this.userRepository.findByEmailWithIdentity(
            credentials.email
        );
        if (!user) {
            // User doesn't exist or has no password identity
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid email or password' },
                'Invalid email or password'
            );
        }

        // Find username-password identity
        const identity = user.identities.find(
            id => id.provider === 'username-password'
        );
        if (!identity) {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid email or password' },
                'Invalid email or password'
            );
        }

        // Compare password
        const isPasswordValid = await this.passwordManager.compare(
            identity.passwordHash,
            credentials.password
        );

        if (!isPasswordValid) {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid email or password' },
                'Invalid email or password'
            );
        }

        // Generate both tokens
        const { accessToken, refreshToken } = this.generateTokens(user);

        // Create new token family for this login session
        const familyId = randomUUID();

        // Store refresh token hash in database with family ID
        const expiresAt = new Date(
            Date.now() + this.config.refreshTokenExpiresIn
        );
        await this.refreshTokenRepository.create(
            user.id,
            this.hashToken(refreshToken),
            familyId,
            expiresAt
        );

        logger.info('User authenticated successfully', {
            userId: user.id,
            familyId,
            event: 'LOGIN',
        });

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
        };
    }

    async refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
        // Verify the refresh token
        let payload: { sub: string; email: string };
        try {
            payload = jwt.verify(refreshToken, this.config.refreshTokenSecret, {
                algorithms: ['HS256'],
            }) as { sub: string; email: string };
        } catch {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid or expired refresh token' },
                'Invalid or expired refresh token'
            );
        }

        // Check if token exists in database
        const tokenHash = this.hashToken(refreshToken);
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

        // Generate new tokens
        const user = { id: payload.sub, email: payload.email };
        const { accessToken, refreshToken: newRefreshToken } =
            this.generateTokens(user);

        // Store new refresh token with SAME family ID (token rotation within family)
        const expiresAt = new Date(
            Date.now() + this.config.refreshTokenExpiresIn
        );
        await this.refreshTokenRepository.create(
            user.id,
            this.hashToken(newRefreshToken),
            storedToken.familyId, // Inherit family ID for rotation tracking
            expiresAt
        );

        logger.debug('Refresh token rotated', {
            userId: user.id,
            familyId: storedToken.familyId,
            event: 'TOKEN_ROTATED',
        });

        return {
            access_token: accessToken,
            refresh_token: newRefreshToken,
        };
    }

    async logout(userId: string, refreshToken: string): Promise<void> {
        const tokenHash = this.hashToken(refreshToken);
        const storedToken =
            await this.refreshTokenRepository.findByTokenHash(tokenHash);

        // Verify token belongs to authenticated user
        if (
            storedToken &&
            storedToken.userId === userId &&
            !storedToken.revokedAt
        ) {
            await this.refreshTokenRepository.revoke(tokenHash);
        }
    }

    async logoutAll(userId: string): Promise<void> {
        await this.refreshTokenRepository.revokeAllForUser(userId);
    }

    async getProfile(userId: string): Promise<SafeUser> {
        // Fetch user WITHOUT sensitive identity data
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundHttpResponse(
                { message: 'User not found' },
                'User not found'
            );
        }

        return user;
    }

    async updateProfile(
        userId: string,
        data: UpdateProfileDto
    ): Promise<SafeUser> {
        // Verify user exists
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundHttpResponse(
                { message: 'User not found' },
                'User not found'
            );
        }

        // Update returns SafeUser without identities
        return this.userRepository.update(userId, data);
    }
}

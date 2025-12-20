import crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { TOKEN } from '../lib/tokens';
import { createLogger } from '../lib/logger';
import type { Config } from '../types/Config';
import type { UserRepository } from '../repositories/user-repository';
import type { PasswordResetTokenRepository } from '../repositories/password-reset-token-repository';
import type { RefreshTokenRepository } from '../repositories/refresh-token-repository';
import type { PasswordManagerService } from './password-manager-service';
import type { MailService } from './mail-service';

const logger = createLogger('PasswordService');

/**
 * Password reset token expiration: 15 minutes (in milliseconds).
 * This is intentionally short for security - OWASP recommends 15-60 minutes.
 */
const PASSWORD_RESET_TOKEN_EXPIRES_IN_MS = 15 * 60 * 1000;

/**
 * Minimum response time for password reset requests (in milliseconds).
 * Used to normalize response timing and prevent user enumeration via timing attacks.
 */
const MIN_RESPONSE_TIME_MS = 500;

/**
 * Base URL for password reset links.
 * SECURITY: Hard-coded to prevent Host Header Injection attacks.
 * In production, this should come from a trusted configuration source.
 */
const PASSWORD_RESET_BASE_URL = 'http://localhost:3000/reset-password';

/**
 * Response message for password reset requests.
 * SECURITY: Same message regardless of whether email exists to prevent user enumeration.
 */
const PASSWORD_RESET_RESPONSE_MESSAGE =
    'If that email address is in our database, we will send you an email to reset your password.';

export interface PasswordResetRequestResult {
    message: string;
}

export interface PasswordResetResult {
    message: string;
}

export interface PasswordService {
    /**
     * Request a password reset for the given email.
     * SECURITY: Always returns the same response regardless of whether email exists
     * to prevent user enumeration.
     */
    requestPasswordReset(email: string): Promise<PasswordResetRequestResult>;

    /**
     * Reset password using a valid reset token.
     * @throws Error if token is invalid, expired, or already used
     */
    resetPassword(
        token: string,
        newPassword: string
    ): Promise<PasswordResetResult>;
}

/**
 * Hash a token using SHA-256.
 * Tokens are stored hashed in the database for security.
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure random token.
 * Uses 32 bytes (256 bits) for high entropy.
 */
function generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Sleep for the specified duration.
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

@injectable()
export class PasswordServiceImpl implements PasswordService {
    constructor(
        @inject(TOKEN.Config) private config: Config,
        @inject(TOKEN.UserRepository) private userRepository: UserRepository,
        @inject(TOKEN.PasswordResetTokenRepository)
        private passwordResetTokenRepository: PasswordResetTokenRepository,
        @inject(TOKEN.RefreshTokenRepository)
        private refreshTokenRepository: RefreshTokenRepository,
        @inject(TOKEN.PasswordManagerService)
        private passwordManager: PasswordManagerService,
        @inject(TOKEN.MailService) private mailService: MailService
    ) {}

    async requestPasswordReset(
        email: string
    ): Promise<PasswordResetRequestResult> {
        const startTime = Date.now();

        try {
            // Normalize email to lowercase for consistent lookup
            const normalizedEmail = email.toLowerCase().trim();

            // Check if user exists
            const user = await this.userRepository.findByEmail(normalizedEmail);

            if (user) {
                // Invalidate any existing reset tokens for this user
                const invalidatedCount =
                    await this.passwordResetTokenRepository.invalidateAllForUser(
                        user.id
                    );
                if (invalidatedCount > 0) {
                    logger.debug('Invalidated existing reset tokens', {
                        userId: user.id,
                        count: invalidatedCount,
                    });
                }

                // Generate secure token
                const token = generateSecureToken();
                const tokenHash = hashToken(token);
                const expiresAt = new Date(
                    Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_IN_MS
                );

                // Store hashed token in database
                await this.passwordResetTokenRepository.create(
                    user.id,
                    tokenHash,
                    expiresAt
                );

                // Build reset URL
                const resetUrl = `${PASSWORD_RESET_BASE_URL}?token=${token}`;

                // Send email
                await this.mailService.sendPasswordResetEmail(
                    normalizedEmail,
                    resetUrl
                );

                logger.info('Password reset requested', {
                    event: 'PASSWORD_RESET_REQUESTED',
                    userId: user.id,
                });
            } else {
                // User doesn't exist, but we don't reveal this
                logger.debug(
                    'Password reset requested for non-existent email',
                    {
                        event: 'PASSWORD_RESET_REQUESTED_UNKNOWN_EMAIL',
                    }
                );
            }
        } catch (error) {
            // Log error but don't reveal to user
            logger.error('Error processing password reset request', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        // Normalize response time to prevent timing attacks
        const elapsed = Date.now() - startTime;
        if (elapsed < MIN_RESPONSE_TIME_MS) {
            await sleep(MIN_RESPONSE_TIME_MS - elapsed);
        }

        // Always return the same message
        return { message: PASSWORD_RESET_RESPONSE_MESSAGE };
    }

    async resetPassword(
        token: string,
        newPassword: string
    ): Promise<PasswordResetResult> {
        // Hash the provided token to look it up
        const tokenHash = hashToken(token);

        // Find valid token
        const resetToken =
            await this.passwordResetTokenRepository.findValidByTokenHash(
                tokenHash
            );

        if (!resetToken) {
            logger.warn('Invalid or expired password reset token used', {
                event: 'PASSWORD_RESET_INVALID_TOKEN',
            });
            throw new Error('Invalid or expired reset token');
        }

        // Get user to verify they exist
        const user = await this.userRepository.findById(resetToken.userId);
        if (!user) {
            logger.error('Password reset token references non-existent user', {
                event: 'PASSWORD_RESET_USER_NOT_FOUND',
                tokenId: resetToken.id,
            });
            throw new Error('Invalid or expired reset token');
        }

        // Hash new password
        const passwordHash = await this.passwordManager.toHash(newPassword);

        // Update password
        await this.userRepository.updatePasswordHash(user.id, passwordHash);

        // Mark token as used (single-use enforcement)
        await this.passwordResetTokenRepository.markAsUsed(resetToken.id);

        // Revoke all refresh tokens for this user (security: force re-login)
        await this.refreshTokenRepository.revokeAllForUser(user.id);

        // Send confirmation email
        await this.mailService.sendPasswordResetConfirmation(user.email);

        logger.info('Password successfully reset', {
            event: 'PASSWORD_RESET_SUCCESS',
            userId: user.id,
        });

        return { message: 'Password has been reset successfully' };
    }
}

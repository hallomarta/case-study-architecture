import { inject, injectable } from 'inversify';
import { PrismaClient, PasswordResetToken } from '@prisma/client';
import { TOKEN } from '../lib/tokens';
import { createLogger } from '../lib/logger';

const logger = createLogger('PasswordResetTokenRepository');

export interface PasswordResetTokenRepository {
    /**
     * Create a new password reset token.
     * @param userId - User ID the token belongs to
     * @param tokenHash - SHA-256 hash of the token (never store plain token)
     * @param expiresAt - Token expiration time
     */
    create(
        userId: string,
        tokenHash: string,
        expiresAt: Date
    ): Promise<PasswordResetToken>;

    /**
     * Find a valid (not expired, not used) token by its hash.
     * @param tokenHash - SHA-256 hash of the token
     */
    findValidByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;

    /**
     * Mark a token as used (single-use enforcement).
     * @param id - Token ID
     */
    markAsUsed(id: string): Promise<void>;

    /**
     * Invalidate all pending reset tokens for a user.
     * Called when a new reset is requested to prevent multiple valid tokens.
     * @param userId - User ID
     */
    invalidateAllForUser(userId: string): Promise<number>;

    /**
     * Delete expired tokens (cleanup job).
     */
    deleteExpired(): Promise<number>;
}

@injectable()
export class PasswordResetTokenRepositoryImpl implements PasswordResetTokenRepository {
    constructor(@inject(TOKEN.PrismaClient) private prisma: PrismaClient) {}

    async create(
        userId: string,
        tokenHash: string,
        expiresAt: Date
    ): Promise<PasswordResetToken> {
        logger.debug('Creating password reset token', { userId });
        return this.prisma.passwordResetToken.create({
            data: {
                userId,
                tokenHash,
                expiresAt,
            },
        });
    }

    async findValidByTokenHash(
        tokenHash: string
    ): Promise<PasswordResetToken | null> {
        return this.prisma.passwordResetToken.findFirst({
            where: {
                tokenHash,
                expiresAt: { gt: new Date() },
                usedAt: null,
            },
        });
    }

    async markAsUsed(id: string): Promise<void> {
        logger.debug('Marking password reset token as used', { tokenId: id });
        await this.prisma.passwordResetToken.update({
            where: { id },
            data: { usedAt: new Date() },
        });
    }

    async invalidateAllForUser(userId: string): Promise<number> {
        logger.debug('Invalidating all password reset tokens for user', {
            userId,
        });
        const result = await this.prisma.passwordResetToken.updateMany({
            where: {
                userId,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            data: { usedAt: new Date() },
        });
        return result.count;
    }

    async deleteExpired(): Promise<number> {
        const result = await this.prisma.passwordResetToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { usedAt: { not: null } },
                ],
            },
        });
        logger.debug('Deleted expired/used password reset tokens', {
            count: result.count,
        });
        return result.count;
    }
}

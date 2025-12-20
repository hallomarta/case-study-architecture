import { inject, injectable } from 'inversify';
import { PrismaClient, RefreshToken } from '@prisma/client';
import { TOKEN } from '../lib/tokens';
import { createLogger } from '../lib/logger';

const logger = createLogger('RefreshTokenRepository');

export interface RefreshTokenRepository {
    create(
        userId: string,
        tokenHash: string,
        familyId: string,
        expiresAt: Date
    ): Promise<RefreshToken>;
    findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
    revoke(tokenHash: string): Promise<void>;
    revokeAllForUser(userId: string): Promise<void>;
    revokeAllByFamilyId(familyId: string): Promise<number>;
    deleteExpired(): Promise<number>;
}

@injectable()
export class RefreshTokenRepositoryImpl implements RefreshTokenRepository {
    constructor(@inject(TOKEN.PrismaClient) private prisma: PrismaClient) {}

    async create(
        userId: string,
        tokenHash: string,
        familyId: string,
        expiresAt: Date
    ): Promise<RefreshToken> {
        logger.debug('Creating refresh token', { userId, familyId });
        return this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash,
                familyId,
                expiresAt,
            },
        });
    }

    async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
        return this.prisma.refreshToken.findUnique({
            where: { tokenHash },
        });
    }

    async revoke(tokenHash: string): Promise<void> {
        await this.prisma.refreshToken.update({
            where: { tokenHash },
            data: { revokedAt: new Date() },
        });
    }

    async revokeAllForUser(userId: string): Promise<void> {
        logger.info('Revoking all tokens for user', { userId });
        await this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    async revokeAllByFamilyId(familyId: string): Promise<number> {
        logger.warn(
            'Revoking all tokens in family (potential reuse detected)',
            { familyId }
        );
        const result = await this.prisma.refreshToken.updateMany({
            where: { familyId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return result.count;
    }

    async deleteExpired(): Promise<number> {
        const result = await this.prisma.refreshToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { revokedAt: { not: null } },
                ],
            },
        });
        logger.debug('Deleted expired tokens', { count: result.count });
        return result.count;
    }
}

import { TestBed, type Mocked } from '@suites/unit';
import { UnauthorizedHttpResponse } from '@inversifyjs/http-core';
import { PasswordServiceImpl } from '../password-service';
import type { UserRepository } from '../../repositories/user-repository';
import type { PasswordResetTokenRepository } from '../../repositories/password-reset-token-repository';
import type { RefreshTokenRepository } from '../../repositories/refresh-token-repository';
import type { PasswordManagerService } from '../password-manager-service';
import type { MailService } from '../mail-service';
import type { SafeUser } from '../../entities/user';
import type { PasswordResetToken } from '@prisma/client';
import { TOKEN } from '../../lib/tokens';
import { createTestConfig } from '../../lib/config';
import type { Config } from '../../types/Config';

const testConfig = createTestConfig({
    accessTokenSecret: 'test-jwt-secret',
    refreshTokenSecret: 'test-refresh-secret',
    accessTokenExpiresIn: 900000,
    refreshTokenExpiresIn: 604800000,
});

describe('PasswordService', () => {
    let service: PasswordServiceImpl;
    let mockUserRepository: Mocked<UserRepository>;
    let mockPasswordResetTokenRepository: Mocked<PasswordResetTokenRepository>;
    let mockRefreshTokenRepository: Mocked<RefreshTokenRepository>;
    let mockPasswordManager: Mocked<PasswordManagerService>;
    let mockMailService: Mocked<MailService>;

    beforeAll(async () => {
        const { unit, unitRef } = await TestBed.solitary(PasswordServiceImpl)
            .mock<Config>(TOKEN.Config)
            .final(testConfig)
            .compile();

        service = unit;
        mockUserRepository = unitRef.get<UserRepository>(TOKEN.UserRepository);
        mockPasswordResetTokenRepository =
            unitRef.get<PasswordResetTokenRepository>(
                TOKEN.PasswordResetTokenRepository
            );
        mockRefreshTokenRepository = unitRef.get<RefreshTokenRepository>(
            TOKEN.RefreshTokenRepository
        );
        mockPasswordManager = unitRef.get<PasswordManagerService>(
            TOKEN.PasswordManagerService
        );
        mockMailService = unitRef.get<MailService>(TOKEN.MailService);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockUser: SafeUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockResetToken: PasswordResetToken = {
        id: 'token-123',
        tokenHash: 'hashed-token',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
        usedAt: null,
    };

    describe('requestPasswordReset', () => {
        it('should return success message for existing user', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            mockPasswordResetTokenRepository.invalidateAllForUser.mockResolvedValue(
                0
            );
            mockPasswordResetTokenRepository.create.mockResolvedValue(
                mockResetToken
            );
            mockMailService.sendPasswordResetEmail.mockResolvedValue(undefined);

            const result =
                await service.requestPasswordReset('test@example.com');

            expect(result).toHaveProperty('message');
            expect(result.message).toContain(
                'If that email address is in our database'
            );
        });

        it('should return same success message for non-existent user (prevent enumeration)', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(null);

            const result = await service.requestPasswordReset(
                'nonexistent@example.com'
            );

            expect(result).toHaveProperty('message');
            expect(result.message).toContain(
                'If that email address is in our database'
            );
        });

        it('should invalidate existing tokens before creating new one', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            mockPasswordResetTokenRepository.invalidateAllForUser.mockResolvedValue(
                2
            );
            mockPasswordResetTokenRepository.create.mockResolvedValue(
                mockResetToken
            );
            mockMailService.sendPasswordResetEmail.mockResolvedValue(undefined);

            await service.requestPasswordReset('test@example.com');

            expect(
                mockPasswordResetTokenRepository.invalidateAllForUser
            ).toHaveBeenCalledWith(mockUser.id);
            expect(mockPasswordResetTokenRepository.create).toHaveBeenCalled();
        });

        it('should create a reset token for existing user', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            mockPasswordResetTokenRepository.invalidateAllForUser.mockResolvedValue(
                0
            );
            mockPasswordResetTokenRepository.create.mockResolvedValue(
                mockResetToken
            );
            mockMailService.sendPasswordResetEmail.mockResolvedValue(undefined);

            await service.requestPasswordReset('test@example.com');

            expect(
                mockPasswordResetTokenRepository.create
            ).toHaveBeenCalledWith(
                mockUser.id,
                expect.any(String), // tokenHash
                expect.any(Date) // expiresAt
            );
        });

        it('should send password reset email for existing user', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            mockPasswordResetTokenRepository.invalidateAllForUser.mockResolvedValue(
                0
            );
            mockPasswordResetTokenRepository.create.mockResolvedValue(
                mockResetToken
            );
            mockMailService.sendPasswordResetEmail.mockResolvedValue(undefined);

            await service.requestPasswordReset('test@example.com');

            expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalledWith(
                'test@example.com',
                expect.stringContaining(
                    'http://localhost:3000/reset-password?token='
                )
            );
        });

        it('should NOT create token for non-existent user', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(null);

            await service.requestPasswordReset('nonexistent@example.com');

            expect(
                mockPasswordResetTokenRepository.create
            ).not.toHaveBeenCalled();
        });

        it('should NOT send email for non-existent user', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(null);

            await service.requestPasswordReset('nonexistent@example.com');

            expect(
                mockMailService.sendPasswordResetEmail
            ).not.toHaveBeenCalled();
        });

        it('should normalize email to lowercase', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            mockPasswordResetTokenRepository.invalidateAllForUser.mockResolvedValue(
                0
            );
            mockPasswordResetTokenRepository.create.mockResolvedValue(
                mockResetToken
            );
            mockMailService.sendPasswordResetEmail.mockResolvedValue(undefined);

            await service.requestPasswordReset('TEST@EXAMPLE.COM');

            expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
                'test@example.com'
            );
        });

        it('should handle repository errors gracefully and still return success', async () => {
            mockUserRepository.findByEmail.mockRejectedValue(
                new Error('Database error')
            );

            const result =
                await service.requestPasswordReset('test@example.com');

            expect(result).toHaveProperty('message');
            expect(result.message).toContain(
                'If that email address is in our database'
            );
        });

        it('should handle mail service errors gracefully and still return success', async () => {
            mockUserRepository.findByEmail.mockResolvedValue(mockUser);
            mockPasswordResetTokenRepository.invalidateAllForUser.mockResolvedValue(
                0
            );
            mockPasswordResetTokenRepository.create.mockResolvedValue(
                mockResetToken
            );
            mockMailService.sendPasswordResetEmail.mockRejectedValue(
                new Error('Mail service error')
            );

            const result =
                await service.requestPasswordReset('test@example.com');

            expect(result).toHaveProperty('message');
            expect(result.message).toContain(
                'If that email address is in our database'
            );
        });
    });

    describe('resetPassword', () => {
        it('should reset password with valid token', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                mockResetToken
            );
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-password');
            mockUserRepository.updatePasswordHash.mockResolvedValue(undefined);
            mockPasswordResetTokenRepository.markAsUsed.mockResolvedValue(
                undefined
            );
            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );
            mockMailService.sendPasswordResetConfirmation.mockResolvedValue(
                undefined
            );

            const result = await service.resetPassword(
                'valid-token',
                'NewPassword123'
            );

            expect(result).toHaveProperty('message');
            expect(result.message).toContain('successfully');
        });

        it('should throw UnauthorizedHttpResponse for invalid token', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                null
            );

            await expect(
                service.resetPassword('invalid-token', 'NewPassword123')
            ).rejects.toThrow(UnauthorizedHttpResponse);
        });

        it('should throw UnauthorizedHttpResponse if user not found', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                mockResetToken
            );
            mockUserRepository.findById.mockResolvedValue(null);

            await expect(
                service.resetPassword('valid-token', 'NewPassword123')
            ).rejects.toThrow(UnauthorizedHttpResponse);
        });

        it('should hash the new password', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                mockResetToken
            );
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-password');
            mockUserRepository.updatePasswordHash.mockResolvedValue(undefined);
            mockPasswordResetTokenRepository.markAsUsed.mockResolvedValue(
                undefined
            );
            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );
            mockMailService.sendPasswordResetConfirmation.mockResolvedValue(
                undefined
            );

            await service.resetPassword('valid-token', 'NewPassword123');

            expect(mockPasswordManager.toHash).toHaveBeenCalledWith(
                'NewPassword123'
            );
        });

        it('should update password hash in repository', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                mockResetToken
            );
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-password');
            mockUserRepository.updatePasswordHash.mockResolvedValue(undefined);
            mockPasswordResetTokenRepository.markAsUsed.mockResolvedValue(
                undefined
            );
            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );
            mockMailService.sendPasswordResetConfirmation.mockResolvedValue(
                undefined
            );

            await service.resetPassword('valid-token', 'NewPassword123');

            expect(mockUserRepository.updatePasswordHash).toHaveBeenCalledWith(
                mockUser.id,
                'new-hashed-password'
            );
        });

        it('should mark token as used after successful reset', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                mockResetToken
            );
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-password');
            mockUserRepository.updatePasswordHash.mockResolvedValue(undefined);
            mockPasswordResetTokenRepository.markAsUsed.mockResolvedValue(
                undefined
            );
            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );
            mockMailService.sendPasswordResetConfirmation.mockResolvedValue(
                undefined
            );

            await service.resetPassword('valid-token', 'NewPassword123');

            expect(
                mockPasswordResetTokenRepository.markAsUsed
            ).toHaveBeenCalledWith(mockResetToken.id);
        });

        it('should revoke all refresh tokens for user', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                mockResetToken
            );
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-password');
            mockUserRepository.updatePasswordHash.mockResolvedValue(undefined);
            mockPasswordResetTokenRepository.markAsUsed.mockResolvedValue(
                undefined
            );
            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );
            mockMailService.sendPasswordResetConfirmation.mockResolvedValue(
                undefined
            );

            await service.resetPassword('valid-token', 'NewPassword123');

            expect(
                mockRefreshTokenRepository.revokeAllForUser
            ).toHaveBeenCalledWith(mockUser.id);
        });

        it('should send confirmation email after successful reset', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                mockResetToken
            );
            mockUserRepository.findById.mockResolvedValue(mockUser);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-password');
            mockUserRepository.updatePasswordHash.mockResolvedValue(undefined);
            mockPasswordResetTokenRepository.markAsUsed.mockResolvedValue(
                undefined
            );
            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );
            mockMailService.sendPasswordResetConfirmation.mockResolvedValue(
                undefined
            );

            await service.resetPassword('valid-token', 'NewPassword123');

            expect(
                mockMailService.sendPasswordResetConfirmation
            ).toHaveBeenCalledWith(mockUser.email);
        });

        it('should hash the token before lookup', async () => {
            mockPasswordResetTokenRepository.findValidByTokenHash.mockResolvedValue(
                null
            );

            try {
                await service.resetPassword('test-token', 'NewPassword123');
            } catch {
                // Expected to throw
            }

            // The token should be hashed (SHA-256 produces 64 hex chars)
            expect(
                mockPasswordResetTokenRepository.findValidByTokenHash
            ).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
        });
    });
});

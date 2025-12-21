import { TestBed, type Mocked } from '@suites/unit';
import { SessionServiceImpl } from '../session-service';
import type { TokenService } from '../token-service';
import type { RefreshTokenRepository } from '../../repositories/refresh-token-repository';
import { TOKEN } from '../../lib/tokens';
import { UnauthorizedHttpResponse } from '@inversifyjs/http-core';

describe('SessionService', () => {
    let service: SessionServiceImpl;
    let mockTokenService: Mocked<TokenService>;
    let mockRefreshTokenRepository: Mocked<RefreshTokenRepository>;

    beforeAll(async () => {
        const { unit, unitRef } =
            await TestBed.solitary(SessionServiceImpl).compile();

        service = unit;
        mockTokenService = unitRef.get<TokenService>(TOKEN.TokenService);
        mockRefreshTokenRepository = unitRef.get<RefreshTokenRepository>(
            TOKEN.RefreshTokenRepository
        );
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createSession', () => {
        it('should create a new session and return refresh token with family ID', async () => {
            const userId = 'user-123';
            const email = 'test@example.com';
            const mockRefreshToken = 'refresh-token-xyz';
            const mockTokenHash = 'hashed-token';

            mockTokenService.generateTokens.mockReturnValue({
                accessToken: 'access-token',
                refreshToken: mockRefreshToken,
                idToken: 'id-token',
            });
            mockTokenService.getRefreshTokenExpiresIn.mockReturnValue(
                604800000
            );
            mockTokenService.hashToken.mockReturnValue(mockTokenHash);
            mockRefreshTokenRepository.create.mockResolvedValue({
                id: 'token-id',
                tokenHash: mockTokenHash,
                userId,
                familyId: expect.any(String),
                expiresAt: expect.any(Date),
                createdAt: new Date(),
                revokedAt: null,
            } as any);

            const result = await service.createSession(userId, email);

            expect(result.refreshToken).toBe(mockRefreshToken);
            expect(result.familyId).toBeDefined();
            expect(typeof result.familyId).toBe('string');
            expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith(
                userId,
                mockTokenHash,
                result.familyId,
                expect.any(Date)
            );
        });
    });

    describe('rotateSession', () => {
        it('should rotate a valid refresh token', async () => {
            const refreshToken = 'old-refresh-token';
            const tokenHash = 'old-token-hash';
            const newRefreshToken = 'new-refresh-token';
            const userId = 'user-123';
            const email = 'test@example.com';
            const familyId = 'family-123';

            const storedToken = {
                id: 'token-id',
                tokenHash,
                userId,
                familyId,
                expiresAt: new Date(Date.now() + 604800000),
                revokedAt: null,
                createdAt: new Date(),
            };

            mockTokenService.verifyRefreshToken.mockReturnValue({
                sub: userId,
                email,
                jti: 'jti-123',
            });
            mockTokenService.hashToken.mockReturnValueOnce(tokenHash);
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                storedToken
            );
            mockRefreshTokenRepository.revoke.mockResolvedValue(undefined);
            mockTokenService.generateTokens.mockReturnValue({
                accessToken: 'new-access-token',
                refreshToken: newRefreshToken,
                idToken: 'new-id-token',
            });
            mockTokenService.hashToken.mockReturnValueOnce('new-token-hash');
            mockTokenService.getRefreshTokenExpiresIn.mockReturnValue(
                604800000
            );
            mockRefreshTokenRepository.create.mockResolvedValue({
                id: 'new-token-id',
                tokenHash: 'new-token-hash',
                userId,
                familyId,
                expiresAt: expect.any(Date),
                createdAt: new Date(),
                revokedAt: null,
            } as any);

            const result = await service.rotateSession(refreshToken);

            expect(result.newRefreshToken).toBe(newRefreshToken);
            expect(result.userId).toBe(userId);
            expect(result.email).toBe(email);
            expect(result.familyId).toBe(familyId);
            expect(mockRefreshTokenRepository.revoke).toHaveBeenCalledWith(
                tokenHash
            );
            expect(mockRefreshTokenRepository.create).toHaveBeenCalled();
        });

        it('should throw UnauthorizedHttpResponse for invalid JWT', async () => {
            mockTokenService.verifyRefreshToken.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await expect(
                service.rotateSession('invalid-token')
            ).rejects.toThrow(UnauthorizedHttpResponse);
        });

        it('should throw UnauthorizedHttpResponse if token not found in database', async () => {
            mockTokenService.verifyRefreshToken.mockReturnValue({
                sub: 'user-123',
                email: 'test@example.com',
                jti: 'jti-123',
            });
            mockTokenService.hashToken.mockReturnValue('token-hash');
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(null);

            await expect(service.rotateSession('valid-token')).rejects.toThrow(
                UnauthorizedHttpResponse
            );
        });

        it('should detect token reuse and revoke entire family', async () => {
            const refreshToken = 'reused-token';
            const tokenHash = 'reused-token-hash';
            const familyId = 'family-123';

            const revokedToken = {
                id: 'token-id',
                tokenHash,
                userId: 'user-123',
                familyId,
                expiresAt: new Date(Date.now() + 604800000),
                revokedAt: new Date(Date.now() - 3600000), // Revoked 1 hour ago
                createdAt: new Date(),
            };

            mockTokenService.verifyRefreshToken.mockReturnValue({
                sub: 'user-123',
                email: 'test@example.com',
                jti: 'jti-123',
            });
            mockTokenService.hashToken.mockReturnValue(tokenHash);
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                revokedToken
            );
            mockRefreshTokenRepository.revokeAllByFamilyId.mockResolvedValue(3);

            await expect(service.rotateSession(refreshToken)).rejects.toThrow(
                UnauthorizedHttpResponse
            );

            expect(
                mockRefreshTokenRepository.revokeAllByFamilyId
            ).toHaveBeenCalledWith(familyId);
        });

        it('should throw UnauthorizedHttpResponse for expired token', async () => {
            const refreshToken = 'expired-token';
            const tokenHash = 'expired-token-hash';

            const expiredToken = {
                id: 'token-id',
                tokenHash,
                userId: 'user-123',
                familyId: 'family-123',
                expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
                revokedAt: null,
                createdAt: new Date(),
            };

            mockTokenService.verifyRefreshToken.mockReturnValue({
                sub: 'user-123',
                email: 'test@example.com',
                jti: 'jti-123',
            });
            mockTokenService.hashToken.mockReturnValue(tokenHash);
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                expiredToken
            );

            await expect(service.rotateSession(refreshToken)).rejects.toThrow(
                UnauthorizedHttpResponse
            );
        });
    });

    describe('revokeSession', () => {
        it('should revoke a valid session for the authenticated user', async () => {
            const userId = 'user-123';
            const refreshToken = 'refresh-token';
            const tokenHash = 'token-hash';

            const storedToken = {
                id: 'token-id',
                tokenHash,
                userId,
                familyId: 'family-123',
                expiresAt: new Date(Date.now() + 604800000),
                revokedAt: null,
                createdAt: new Date(),
            };

            mockTokenService.hashToken.mockReturnValue(tokenHash);
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                storedToken
            );
            mockRefreshTokenRepository.revoke.mockResolvedValue(undefined);

            await service.revokeSession(userId, refreshToken);

            expect(mockRefreshTokenRepository.revoke).toHaveBeenCalledWith(
                tokenHash
            );
        });

        it('should not revoke if token belongs to different user', async () => {
            const userId = 'user-123';
            const refreshToken = 'refresh-token';
            const tokenHash = 'token-hash';

            const storedToken = {
                id: 'token-id',
                tokenHash,
                userId: 'different-user',
                familyId: 'family-123',
                expiresAt: new Date(Date.now() + 604800000),
                revokedAt: null,
                createdAt: new Date(),
            };

            mockTokenService.hashToken.mockReturnValue(tokenHash);
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                storedToken
            );

            await service.revokeSession(userId, refreshToken);

            expect(mockRefreshTokenRepository.revoke).not.toHaveBeenCalled();
        });

        it('should not revoke if token is already revoked', async () => {
            const userId = 'user-123';
            const refreshToken = 'refresh-token';
            const tokenHash = 'token-hash';

            const storedToken = {
                id: 'token-id',
                tokenHash,
                userId,
                familyId: 'family-123',
                expiresAt: new Date(Date.now() + 604800000),
                revokedAt: new Date(),
                createdAt: new Date(),
            };

            mockTokenService.hashToken.mockReturnValue(tokenHash);
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                storedToken
            );

            await service.revokeSession(userId, refreshToken);

            expect(mockRefreshTokenRepository.revoke).not.toHaveBeenCalled();
        });
    });

    describe('revokeAllSessions', () => {
        it('should revoke all sessions for a user', async () => {
            const userId = 'user-123';

            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );

            await service.revokeAllSessions(userId);

            expect(
                mockRefreshTokenRepository.revokeAllForUser
            ).toHaveBeenCalledWith(userId);
        });
    });
});

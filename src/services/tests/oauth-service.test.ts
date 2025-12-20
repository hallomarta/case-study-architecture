import { TestBed, type Mocked } from '@suites/unit';
import { OAuthService } from '../oauth-service';
import type { IdentityProvider } from '../../providers/identity-provider';
import type { TokenService } from '../token-service';
import type { SessionService } from '../session-service';
import type { UserService } from '../user-service';
import type { SafeUser } from '../../entities/user';
import { TOKEN } from '../../lib/tokens';
import { BadRequestHttpResponse } from '@inversifyjs/http-core';

describe('OAuthService', () => {
    let service: OAuthService;
    let mockIdentityProvider: Mocked<IdentityProvider>;
    let mockTokenService: Mocked<TokenService>;
    let mockSessionService: Mocked<SessionService>;
    let mockUserService: Mocked<UserService>;

    beforeAll(async () => {
        const { unit, unitRef } =
            await TestBed.solitary(OAuthService).compile();

        service = unit;
        mockIdentityProvider = unitRef.get<IdentityProvider>(
            TOKEN.IdentityProvider
        );
        mockTokenService = unitRef.get<TokenService>(TOKEN.TokenService);
        mockSessionService = unitRef.get<SessionService>(TOKEN.SessionService);
        mockUserService = unitRef.get<UserService>(TOKEN.UserService);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('handlePasswordGrant', () => {
        it('should authenticate user and return token response', async () => {
            const email = 'user@example.com';
            const password = 'Test123456';

            const mockUser: SafeUser = {
                id: 'user-123',
                email,
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockRefreshToken = 'refresh-token-xyz';
            const mockAccessToken = 'access-token-abc';
            const mockIdToken = 'id-token-def';

            mockIdentityProvider.authenticate.mockResolvedValue(mockUser);
            mockSessionService.createSession.mockResolvedValue({
                refreshToken: mockRefreshToken,
                familyId: 'family-123',
            });
            mockTokenService.generateTokens.mockReturnValue({
                accessToken: mockAccessToken,
                refreshToken: 'unused-refresh-token',
                idToken: mockIdToken,
            });
            mockTokenService.getRefreshTokenExpiresIn.mockReturnValue(900000); // 15 minutes

            const result = await service.handlePasswordGrant(email, password);

            expect(mockIdentityProvider.authenticate).toHaveBeenCalledWith({
                email,
                password,
            });
            expect(mockSessionService.createSession).toHaveBeenCalledWith(
                mockUser.id,
                mockUser.email
            );
            expect(mockTokenService.generateTokens).toHaveBeenCalledWith(
                mockUser
            );

            expect(result).toEqual({
                access_token: mockAccessToken,
                token_type: 'Bearer',
                expires_in: 900,
                refresh_token: mockRefreshToken,
                id_token: mockIdToken,
            });
        });
    });

    describe('handleRefreshTokenGrant', () => {
        it('should rotate token and return new token response', async () => {
            const refreshToken = 'old-refresh-token';
            const newRefreshToken = 'new-refresh-token';
            const userId = 'user-123';

            const mockUser: SafeUser = {
                id: userId,
                email: 'user@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const mockAccessToken = 'new-access-token';
            const mockIdToken = 'new-id-token';

            mockSessionService.rotateSession.mockResolvedValue({
                newRefreshToken,
                userId,
                email: 'user@example.com',
                familyId: 'family-123',
            });
            mockUserService.findById.mockResolvedValue(mockUser);
            mockTokenService.generateTokens.mockReturnValue({
                accessToken: mockAccessToken,
                refreshToken: 'unused-refresh-token',
                idToken: mockIdToken,
            });
            mockTokenService.getRefreshTokenExpiresIn.mockReturnValue(900000);

            const result = await service.handleRefreshTokenGrant(refreshToken);

            expect(mockSessionService.rotateSession).toHaveBeenCalledWith(
                refreshToken
            );
            expect(mockUserService.findById).toHaveBeenCalledWith(userId);
            expect(mockTokenService.generateTokens).toHaveBeenCalledWith(
                mockUser
            );

            expect(result).toEqual({
                access_token: mockAccessToken,
                token_type: 'Bearer',
                expires_in: 900,
                refresh_token: newRefreshToken,
                id_token: mockIdToken,
            });
        });

        it('should throw BadRequestHttpResponse if user not found after rotation', async () => {
            const refreshToken = 'valid-refresh-token';
            const userId = 'user-123';

            mockSessionService.rotateSession.mockResolvedValue({
                newRefreshToken: 'new-token',
                userId,
                email: 'user@example.com',
                familyId: 'family-123',
            });
            mockUserService.findById.mockResolvedValue(null);

            await expect(
                service.handleRefreshTokenGrant(refreshToken)
            ).rejects.toThrow(BadRequestHttpResponse);

            expect(mockSessionService.rotateSession).toHaveBeenCalledWith(
                refreshToken
            );
            expect(mockUserService.findById).toHaveBeenCalledWith(userId);
            expect(mockTokenService.generateTokens).not.toHaveBeenCalled();
        });
    });
});

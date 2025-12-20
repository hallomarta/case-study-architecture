import { TestBed, type Mocked } from '@suites/unit';
import { UserServiceImpl } from '../user-service';
import type { UserRepository } from '../../repositories/user-repository';
import type { SafeUser, UserWithIdentity } from '../../entities/user';
import type { PasswordManagerService } from '../password-manager-service';
import { TOKEN } from '../../lib/tokens';
import {
    ConflictHttpResponse,
    UnauthorizedHttpResponse,
} from '@inversifyjs/http-core';
import { createTestConfig } from '../../lib/config';
import type { RefreshTokenRepository } from '../../repositories/refresh-token-repository';
import type { Config } from '../../types/Config';

const testConfig = createTestConfig({
    accessTokenSecret: 'test-jwt-secret',
    refreshTokenSecret: 'test-refresh-secret',
    accessTokenExpiresIn: 900000, // 15 minutes
    refreshTokenExpiresIn: 604800000, // 7 days
});

describe('UserService', () => {
    let service: UserServiceImpl;
    let mockUserRepository: Mocked<UserRepository>;
    let mockPasswordManager: Mocked<PasswordManagerService>;
    let mockRefreshTokenRepository: Mocked<RefreshTokenRepository>;

    beforeAll(async () => {
        const { unit, unitRef } = await TestBed.solitary(UserServiceImpl)
            .mock<Config>(TOKEN.Config)
            .final(testConfig)
            .compile();

        service = unit;
        mockUserRepository = unitRef.get<UserRepository>(TOKEN.UserRepository);
        mockPasswordManager = unitRef.get<PasswordManagerService>(
            TOKEN.PasswordManagerService
        );
        mockRefreshTokenRepository = unitRef.get<RefreshTokenRepository>(
            TOKEN.RefreshTokenRepository
        );
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                email: 'new@example.com',
                password: 'Test123456',
                firstName: 'John',
                lastName: 'Doe',
            };

            mockUserRepository.findByEmail.mockResolvedValue(null);
            mockPasswordManager.toHash.mockResolvedValue('hashed_password');

            const mockCreatedUser: SafeUser = {
                id: '123',
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.create.mockResolvedValue(mockCreatedUser);

            const result = await service.register(userData);

            expect(result).toEqual({
                id: mockCreatedUser.id,
                email: mockCreatedUser.email,
                firstName: mockCreatedUser.firstName,
                lastName: mockCreatedUser.lastName,
                createdAt: mockCreatedUser.createdAt,
                updatedAt: mockCreatedUser.updatedAt,
            });
            expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
                userData.email
            );
            expect(mockPasswordManager.toHash).toHaveBeenCalledWith(
                userData.password
            );
            expect(mockUserRepository.create).toHaveBeenCalledWith({
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                password: 'hashed_password',
            });
        });

        it('should throw ConflictHttpResponse if email already exists', async () => {
            const userData = {
                email: 'existing@example.com',
                password: 'Test123456',
                firstName: 'John',
                lastName: 'Doe',
            };

            const existingUser: SafeUser = {
                id: '123',
                email: userData.email,
                firstName: 'Existing',
                lastName: 'User',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.findByEmail.mockResolvedValue(existingUser);

            await expect(service.register(userData)).rejects.toThrow(
                ConflictHttpResponse
            );
            expect(mockPasswordManager.toHash).not.toHaveBeenCalled();
            expect(mockUserRepository.create).not.toHaveBeenCalled();
        });

        it('should not return identities in response', async () => {
            const userData = {
                email: 'new@example.com',
                password: 'Test123456',
                firstName: 'John',
                lastName: 'Doe',
            };

            mockUserRepository.findByEmail.mockResolvedValue(null);
            mockPasswordManager.toHash.mockResolvedValue('hashed_password');

            const mockCreatedUser: SafeUser = {
                id: '123',
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.create.mockResolvedValue(mockCreatedUser);

            const result = await service.register(userData);

            expect(result).not.toHaveProperty('identities');
        });
    });

    describe('authenticate', () => {
        it('should authenticate user with valid credentials and return access_token', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'Test123456',
            };

            const mockUser: UserWithIdentity = {
                id: '123',
                email: credentials.email,
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
                identities: [
                    {
                        id: '1',
                        userId: '123',
                        provider: 'username-password',
                        passwordHash: 'hashed_password',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        lastLoginAt: null,
                    },
                ],
            };

            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(
                mockUser
            );
            mockPasswordManager.compare.mockResolvedValue(true);

            const result = await service.authenticate(credentials);

            expect(result).toHaveProperty('access_token');
            expect(typeof result.access_token).toBe('string');
            expect(
                mockUserRepository.findByEmailWithIdentity
            ).toHaveBeenCalledWith(credentials.email);
            expect(mockPasswordManager.compare).toHaveBeenCalledWith(
                'hashed_password',
                credentials.password
            );
        });

        it('should throw UnauthorizedHttpResponse if user not found', async () => {
            const credentials = {
                email: 'nonexistent@example.com',
                password: 'Test123456',
            };

            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(null);

            await expect(service.authenticate(credentials)).rejects.toThrow(
                UnauthorizedHttpResponse
            );
            expect(mockPasswordManager.compare).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedHttpResponse if password is invalid', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'WrongPassword',
            };

            const mockUser: UserWithIdentity = {
                id: '123',
                email: credentials.email,
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
                identities: [
                    {
                        id: '1',
                        userId: '123',
                        provider: 'username-password',
                        passwordHash: 'hashed_password',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        lastLoginAt: null,
                    },
                ],
            };

            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(
                mockUser
            );
            mockPasswordManager.compare.mockResolvedValue(false);

            await expect(service.authenticate(credentials)).rejects.toThrow(
                UnauthorizedHttpResponse
            );
        });

        it('should throw UnauthorizedHttpResponse if user has no identities', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'Test123456',
            };

            // findByEmailWithIdentity returns null if user has no identities
            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(null);

            await expect(service.authenticate(credentials)).rejects.toThrow(
                UnauthorizedHttpResponse
            );
        });
    });

    describe('getProfile', () => {
        it('should return user profile without identities', async () => {
            const mockUser: SafeUser = {
                id: '123',
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.findById.mockResolvedValue(mockUser);

            const result = await service.getProfile('123');

            expect(result).toEqual({
                id: mockUser.id,
                email: mockUser.email,
                firstName: mockUser.firstName,
                lastName: mockUser.lastName,
                createdAt: mockUser.createdAt,
                updatedAt: mockUser.updatedAt,
            });
            expect(result).not.toHaveProperty('identities');
        });

        it('should throw error if user not found', async () => {
            mockUserRepository.findById.mockResolvedValue(null);

            await expect(service.getProfile('nonexistent')).rejects.toThrow(
                'User not found'
            );
        });
    });

    describe('updateProfile', () => {
        it('should update user profile and return without identities', async () => {
            const updateData = {
                firstName: 'Updated',
                lastName: 'Name',
            };

            const mockUpdatedUser: SafeUser = {
                id: '123',
                email: 'test@example.com',
                firstName: updateData.firstName,
                lastName: updateData.lastName,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Mock both findById (for validation) and update
            mockUserRepository.findById.mockResolvedValue(mockUpdatedUser);
            mockUserRepository.update.mockResolvedValue(mockUpdatedUser);

            const result = await service.updateProfile('123', updateData);

            expect(result).toEqual({
                id: mockUpdatedUser.id,
                email: mockUpdatedUser.email,
                firstName: mockUpdatedUser.firstName,
                lastName: mockUpdatedUser.lastName,
                createdAt: mockUpdatedUser.createdAt,
                updatedAt: mockUpdatedUser.updatedAt,
            });
            expect(result).not.toHaveProperty('identities');
            expect(mockUserRepository.update).toHaveBeenCalledWith(
                '123',
                updateData
            );
        });

        it('should update only firstName', async () => {
            const updateData = {
                firstName: 'OnlyFirst',
            };

            const mockUpdatedUser: SafeUser = {
                id: '123',
                email: 'test@example.com',
                firstName: updateData.firstName,
                lastName: 'Unchanged',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Mock both findById and update
            mockUserRepository.findById.mockResolvedValue(mockUpdatedUser);
            mockUserRepository.update.mockResolvedValue(mockUpdatedUser);

            const result = await service.updateProfile('123', updateData);

            expect(result.firstName).toBe('OnlyFirst');
            expect(result.lastName).toBe('Unchanged');
        });
    });

    describe('refreshAccessToken', () => {
        const mockStoredToken = {
            id: 'token-id',
            tokenHash: 'hashed-refresh-token',
            userId: '123',
            familyId: 'family-123',
            expiresAt: new Date(Date.now() + 604800000), // 7 days from now
            createdAt: new Date(),
            revokedAt: null,
        };

        it('should successfully refresh tokens and rotate refresh token', async () => {
            // Create a valid JWT for testing
            const jwt = await import('jsonwebtoken');
            const validRefreshToken = jwt.sign(
                { sub: '123', email: 'test@example.com', jti: 'unique-id' },
                testConfig.refreshTokenSecret,
                { expiresIn: '7d', algorithm: 'HS256' }
            );

            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                mockStoredToken
            );
            mockRefreshTokenRepository.revoke.mockResolvedValue(undefined);
            mockRefreshTokenRepository.create.mockResolvedValue({
                ...mockStoredToken,
                id: 'new-token-id',
                tokenHash: 'new-hashed-token',
            });

            const result = await service.refreshAccessToken(validRefreshToken);

            expect(result).toHaveProperty('access_token');
            expect(result).toHaveProperty('refresh_token');
            expect(typeof result.access_token).toBe('string');
            expect(typeof result.refresh_token).toBe('string');
            // Verify old token was revoked
            expect(mockRefreshTokenRepository.revoke).toHaveBeenCalled();
            // Verify new token was created with same family ID
            expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith(
                '123',
                expect.any(String),
                'family-123', // Same family ID for rotation tracking
                expect.any(Date)
            );
        });

        it('should throw UnauthorizedHttpResponse for invalid JWT signature', async () => {
            const invalidToken = 'invalid.jwt.token';

            await expect(
                service.refreshAccessToken(invalidToken)
            ).rejects.toThrow(UnauthorizedHttpResponse);
            expect(
                mockRefreshTokenRepository.findByTokenHash
            ).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedHttpResponse for expired JWT', async () => {
            const jwt = await import('jsonwebtoken');
            // Create an already expired token
            const expiredToken = jwt.sign(
                { sub: '123', email: 'test@example.com', jti: 'unique-id' },
                testConfig.refreshTokenSecret,
                { expiresIn: '-1s', algorithm: 'HS256' } // Already expired
            );

            await expect(
                service.refreshAccessToken(expiredToken)
            ).rejects.toThrow(UnauthorizedHttpResponse);
        });

        it('should throw UnauthorizedHttpResponse if token not found in database', async () => {
            const jwt = await import('jsonwebtoken');
            const validRefreshToken = jwt.sign(
                { sub: '123', email: 'test@example.com', jti: 'unique-id' },
                testConfig.refreshTokenSecret,
                { expiresIn: '7d', algorithm: 'HS256' }
            );

            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(null);

            await expect(
                service.refreshAccessToken(validRefreshToken)
            ).rejects.toThrow(UnauthorizedHttpResponse);
        });

        it('should detect token reuse and invalidate entire token family', async () => {
            const jwt = await import('jsonwebtoken');
            const validRefreshToken = jwt.sign(
                { sub: '123', email: 'test@example.com', jti: 'unique-id' },
                testConfig.refreshTokenSecret,
                { expiresIn: '7d', algorithm: 'HS256' }
            );

            // Token was already revoked - indicates reuse attack
            const revokedToken = {
                ...mockStoredToken,
                revokedAt: new Date(), // Already revoked!
            };

            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                revokedToken
            );
            mockRefreshTokenRepository.revokeAllByFamilyId.mockResolvedValue(3);

            await expect(
                service.refreshAccessToken(validRefreshToken)
            ).rejects.toThrow(UnauthorizedHttpResponse);
            // Verify entire family was invalidated
            expect(
                mockRefreshTokenRepository.revokeAllByFamilyId
            ).toHaveBeenCalledWith('family-123');
        });

        it('should throw UnauthorizedHttpResponse if database token has expired', async () => {
            const jwt = await import('jsonwebtoken');
            const validRefreshToken = jwt.sign(
                { sub: '123', email: 'test@example.com', jti: 'unique-id' },
                testConfig.refreshTokenSecret,
                { expiresIn: '7d', algorithm: 'HS256' }
            );

            // Token in database is expired (even though JWT might still be valid)
            const expiredStoredToken = {
                ...mockStoredToken,
                expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
            };

            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                expiredStoredToken
            );

            await expect(
                service.refreshAccessToken(validRefreshToken)
            ).rejects.toThrow(UnauthorizedHttpResponse);
        });

        it('should throw UnauthorizedHttpResponse for token signed with wrong secret', async () => {
            const jwt = await import('jsonwebtoken');
            const tokenWithWrongSecret = jwt.sign(
                { sub: '123', email: 'test@example.com', jti: 'unique-id' },
                'wrong-secret',
                { expiresIn: '7d', algorithm: 'HS256' }
            );

            await expect(
                service.refreshAccessToken(tokenWithWrongSecret)
            ).rejects.toThrow(UnauthorizedHttpResponse);
        });
    });

    describe('logout', () => {
        const mockStoredToken = {
            id: 'token-id',
            tokenHash: 'hashed-refresh-token',
            userId: '123',
            familyId: 'family-123',
            expiresAt: new Date(Date.now() + 604800000),
            createdAt: new Date(),
            revokedAt: null,
        };

        it('should revoke refresh token for authenticated user', async () => {
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                mockStoredToken
            );
            mockRefreshTokenRepository.revoke.mockResolvedValue(undefined);

            await service.logout('123', 'valid-refresh-token');

            expect(mockRefreshTokenRepository.revoke).toHaveBeenCalled();
        });

        it('should not revoke token if userId does not match', async () => {
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                mockStoredToken
            );

            // Try to logout with different user ID
            await service.logout('different-user-id', 'valid-refresh-token');

            expect(mockRefreshTokenRepository.revoke).not.toHaveBeenCalled();
        });

        it('should not revoke token if already revoked', async () => {
            const alreadyRevokedToken = {
                ...mockStoredToken,
                revokedAt: new Date(),
            };
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(
                alreadyRevokedToken
            );

            await service.logout('123', 'already-revoked-token');

            expect(mockRefreshTokenRepository.revoke).not.toHaveBeenCalled();
        });

        it('should handle non-existent token gracefully', async () => {
            mockRefreshTokenRepository.findByTokenHash.mockResolvedValue(null);

            // Should not throw, just do nothing
            await expect(
                service.logout('123', 'non-existent-token')
            ).resolves.toBeUndefined();
            expect(mockRefreshTokenRepository.revoke).not.toHaveBeenCalled();
        });
    });

    describe('logoutAll', () => {
        it('should revoke all refresh tokens for user', async () => {
            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );

            await service.logoutAll('123');

            expect(
                mockRefreshTokenRepository.revokeAllForUser
            ).toHaveBeenCalledWith('123');
        });

        it('should not throw if user has no tokens', async () => {
            mockRefreshTokenRepository.revokeAllForUser.mockResolvedValue(
                undefined
            );

            await expect(
                service.logoutAll('user-with-no-tokens')
            ).resolves.toBeUndefined();
        });
    });

    describe('authenticate - extended token tests', () => {
        const mockUser: UserWithIdentity = {
            id: '123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            createdAt: new Date(),
            updatedAt: new Date(),
            identities: [
                {
                    id: '1',
                    userId: '123',
                    provider: 'username-password',
                    passwordHash: 'hashed_password',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastLoginAt: null,
                },
            ],
        };

        it('should return both access_token and refresh_token', async () => {
            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(
                mockUser
            );
            mockPasswordManager.compare.mockResolvedValue(true);
            mockRefreshTokenRepository.create.mockResolvedValue({
                id: 'token-id',
                tokenHash: 'hashed-token',
                userId: '123',
                familyId: 'family-123',
                expiresAt: new Date(Date.now() + 604800000),
                createdAt: new Date(),
                revokedAt: null,
            });

            const result = await service.authenticate({
                email: 'test@example.com',
                password: 'Test123456',
            });

            expect(result).toHaveProperty('access_token');
            expect(result).toHaveProperty('refresh_token');
            expect(typeof result.access_token).toBe('string');
            expect(typeof result.refresh_token).toBe('string');
        });

        it('should store refresh token in database with family ID', async () => {
            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(
                mockUser
            );
            mockPasswordManager.compare.mockResolvedValue(true);
            mockRefreshTokenRepository.create.mockResolvedValue({
                id: 'token-id',
                tokenHash: 'hashed-token',
                userId: '123',
                familyId: 'family-123',
                expiresAt: new Date(Date.now() + 604800000),
                createdAt: new Date(),
                revokedAt: null,
            });

            await service.authenticate({
                email: 'test@example.com',
                password: 'Test123456',
            });

            expect(mockRefreshTokenRepository.create).toHaveBeenCalledWith(
                '123', // userId
                expect.any(String), // tokenHash
                expect.any(String), // familyId (UUID)
                expect.any(Date) // expiresAt
            );
        });

        it('should create tokens with correct expiration from config', async () => {
            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(
                mockUser
            );
            mockPasswordManager.compare.mockResolvedValue(true);
            mockRefreshTokenRepository.create.mockResolvedValue({
                id: 'token-id',
                tokenHash: 'hashed-token',
                userId: '123',
                familyId: 'family-123',
                expiresAt: new Date(
                    Date.now() + testConfig.refreshTokenExpiresIn
                ),
                createdAt: new Date(),
                revokedAt: null,
            });

            const beforeAuth = Date.now();
            await service.authenticate({
                email: 'test@example.com',
                password: 'Test123456',
            });
            const afterAuth = Date.now();

            // Verify the expiration date is correctly calculated
            const createCall = mockRefreshTokenRepository.create.mock.calls[0];
            const expiresAt = createCall[3] as Date;
            const expectedMinExpiry =
                beforeAuth + testConfig.refreshTokenExpiresIn;
            const expectedMaxExpiry =
                afterAuth + testConfig.refreshTokenExpiresIn;

            expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
                expectedMinExpiry
            );
            expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry);
        });

        it('should throw UnauthorizedHttpResponse if user has no password identity', async () => {
            const userWithOAuthOnly: UserWithIdentity = {
                ...mockUser,
                identities: [
                    {
                        id: '1',
                        userId: '123',
                        provider: 'google', // OAuth, not username-password
                        passwordHash: null as unknown as string,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        lastLoginAt: null,
                    },
                ],
            };

            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(
                userWithOAuthOnly
            );

            await expect(
                service.authenticate({
                    email: 'test@example.com',
                    password: 'Test123456',
                })
            ).rejects.toThrow(UnauthorizedHttpResponse);
        });

        it('should generate valid JWT access tokens', async () => {
            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(
                mockUser
            );
            mockPasswordManager.compare.mockResolvedValue(true);
            mockRefreshTokenRepository.create.mockResolvedValue({
                id: 'token-id',
                tokenHash: 'hashed-token',
                userId: '123',
                familyId: 'family-123',
                expiresAt: new Date(Date.now() + 604800000),
                createdAt: new Date(),
                revokedAt: null,
            });

            const result = await service.authenticate({
                email: 'test@example.com',
                password: 'Test123456',
            });

            // Verify the access token can be decoded and has correct payload
            const jwt = await import('jsonwebtoken');
            const decoded = jwt.verify(
                result.access_token,
                testConfig.accessTokenSecret,
                {
                    algorithms: ['HS256'],
                }
            ) as { sub: string; email: string };

            expect(decoded.sub).toBe('123');
            expect(decoded.email).toBe('test@example.com');
        });

        it('should generate valid JWT refresh tokens', async () => {
            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(
                mockUser
            );
            mockPasswordManager.compare.mockResolvedValue(true);
            mockRefreshTokenRepository.create.mockResolvedValue({
                id: 'token-id',
                tokenHash: 'hashed-token',
                userId: '123',
                familyId: 'family-123',
                expiresAt: new Date(Date.now() + 604800000),
                createdAt: new Date(),
                revokedAt: null,
            });

            const result = await service.authenticate({
                email: 'test@example.com',
                password: 'Test123456',
            });

            // Verify the refresh token can be decoded and has correct payload
            const jwt = await import('jsonwebtoken');
            const decoded = jwt.verify(
                result.refresh_token,
                testConfig.refreshTokenSecret,
                {
                    algorithms: ['HS256'],
                }
            ) as { sub: string; email: string; jti: string };

            expect(decoded.sub).toBe('123');
            expect(decoded.email).toBe('test@example.com');
            expect(decoded.jti).toBeDefined(); // Unique token ID
        });
    });
});

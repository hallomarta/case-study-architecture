import { TestBed, type Mocked } from '@suites/unit';
import { TokenServiceImpl } from '../token-service';
import type { Config } from '../../types/Config';
import { TOKEN } from '../../lib/tokens';
import type { SafeUser } from '../../entities/user';
import jwt from 'jsonwebtoken';

describe('TokenService', () => {
    let service: TokenServiceImpl;
    let mockConfig: Mocked<Config>;

    const mockUser: SafeUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeAll(async () => {
        const { unit, unitRef } =
            await TestBed.solitary(TokenServiceImpl).compile();

        service = unit;
        mockConfig = unitRef.get<Config>(TOKEN.Config);

        // Set up config defaults
        mockConfig.accessTokenSecret = 'test-access-secret';
        mockConfig.refreshTokenSecret = 'test-refresh-secret';
        mockConfig.accessTokenExpiresIn = 900000; // 15 minutes
        mockConfig.refreshTokenExpiresIn = 604800000; // 7 days
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateTokens', () => {
        it('should generate access, refresh, and id tokens', () => {
            const tokens = service.generateTokens(mockUser);

            expect(tokens).toHaveProperty('accessToken');
            expect(tokens).toHaveProperty('refreshToken');
            expect(tokens).toHaveProperty('idToken');
            expect(typeof tokens.accessToken).toBe('string');
            expect(typeof tokens.refreshToken).toBe('string');
            expect(typeof tokens.idToken).toBe('string');
        });

        it('should generate valid JWT tokens that can be verified', () => {
            const tokens = service.generateTokens(mockUser);

            // Verify access token
            const accessPayload = jwt.verify(
                tokens.accessToken,
                mockConfig.accessTokenSecret
            ) as any;
            expect(accessPayload.sub).toBe(mockUser.id);
            expect(accessPayload.email).toBe(mockUser.email);

            // Verify refresh token
            const refreshPayload = jwt.verify(
                tokens.refreshToken,
                mockConfig.refreshTokenSecret
            ) as any;
            expect(refreshPayload.sub).toBe(mockUser.id);
            expect(refreshPayload.email).toBe(mockUser.email);
            expect(refreshPayload.jti).toBeDefined();

            // Verify id token
            const idPayload = jwt.verify(
                tokens.idToken,
                mockConfig.accessTokenSecret
            ) as any;
            expect(idPayload.sub).toBe(mockUser.id);
            expect(idPayload.email).toBe(mockUser.email);
            expect(idPayload.given_name).toBe(mockUser.firstName);
            expect(idPayload.family_name).toBe(mockUser.lastName);
        });
    });

    describe('verifyAccessToken', () => {
        it('should verify and decode a valid access token', () => {
            const tokens = service.generateTokens(mockUser);
            const payload = service.verifyAccessToken(tokens.accessToken);

            expect(payload.sub).toBe(mockUser.id);
            expect(payload.email).toBe(mockUser.email);
        });

        it('should throw error for invalid access token', () => {
            expect(() => service.verifyAccessToken('invalid-token')).toThrow();
        });

        it('should throw error for expired access token', () => {
            const expiredToken = jwt.sign(
                { sub: mockUser.id, email: mockUser.email },
                mockConfig.accessTokenSecret,
                { expiresIn: '-1s', algorithm: 'HS256' }
            );

            expect(() => service.verifyAccessToken(expiredToken)).toThrow();
        });
    });

    describe('verifyRefreshToken', () => {
        it('should verify and decode a valid refresh token', () => {
            const tokens = service.generateTokens(mockUser);
            const payload = service.verifyRefreshToken(tokens.refreshToken);

            expect(payload.sub).toBe(mockUser.id);
            expect(payload.email).toBe(mockUser.email);
            expect(payload.jti).toBeDefined();
        });

        it('should throw error for invalid refresh token', () => {
            expect(() => service.verifyRefreshToken('invalid-token')).toThrow();
        });
    });

    describe('hashToken', () => {
        it('should hash a token consistently', () => {
            const token = 'test-token-123';
            const hash1 = service.hashToken(token);
            const hash2 = service.hashToken(token);

            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
        });

        it('should produce different hashes for different tokens', () => {
            const hash1 = service.hashToken('token1');
            const hash2 = service.hashToken('token2');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('getRefreshTokenExpiresIn', () => {
        it('should return the configured refresh token expiration time', () => {
            const expiresIn = service.getRefreshTokenExpiresIn();
            expect(expiresIn).toBe(mockConfig.refreshTokenExpiresIn);
        });
    });

    describe('buildTokenResponse', () => {
        it('should build a complete token response', () => {
            const refreshToken = 'test-refresh-token';
            const response = service.buildTokenResponse(mockUser, refreshToken);

            expect(response).toEqual({
                access_token: expect.any(String),
                token_type: 'Bearer',
                expires_in: 900, // 15 minutes in seconds
                refresh_token: refreshToken,
                id_token: expect.any(String),
            });
        });
    });
});

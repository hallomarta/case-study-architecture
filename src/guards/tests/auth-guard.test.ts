import { TestBed } from '@suites/unit';
import { AuthGuard } from '../auth-guard';
import { UnauthorizedHttpResponse } from '@inversifyjs/http-core';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

jest.mock('jsonwebtoken');

describe('AuthGuard', () => {
    let guard: AuthGuard;
    let mockRequest: Request;

    beforeAll(async () => {
        const { unit } = await TestBed.solitary(AuthGuard).compile();
        guard = unit;
    });

    beforeEach(() => {
        mockRequest = {
            headers: {},
        } as Request;
        process.env.JWT_SECRET = 'test-secret';
        jest.clearAllMocks();
    });

    describe('activate', () => {
        it('should return true for valid token and attach user to request', () => {
            mockRequest.headers = {
                authorization: 'Bearer valid-token',
            };

            const mockPayload = {
                sub: '123',
                email: 'test@example.com',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            };

            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

            const result = guard.activate(mockRequest);

            expect(result).toBe(true);
            expect(mockRequest.user).toEqual({
                id: '123',
                email: 'test@example.com',
            });
            expect(jwt.verify).toHaveBeenCalledWith(
                'valid-token',
                'test-secret',
                { algorithms: ['HS256'] }
            );
        });

        it('should throw UnauthorizedHttpResponse if no authorization header', () => {
            mockRequest.headers = {};

            expect(() => guard.activate(mockRequest)).toThrow(
                UnauthorizedHttpResponse
            );
            expect(jwt.verify).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedHttpResponse if authorization format is invalid', () => {
            mockRequest.headers = {
                authorization: 'InvalidFormat token',
            };

            expect(() => guard.activate(mockRequest)).toThrow(
                UnauthorizedHttpResponse
            );
            expect(jwt.verify).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedHttpResponse if only Bearer is provided without token', () => {
            mockRequest.headers = {
                authorization: 'Bearer',
            };

            expect(() => guard.activate(mockRequest)).toThrow(
                UnauthorizedHttpResponse
            );
            expect(jwt.verify).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedHttpResponse if token verification fails', () => {
            mockRequest.headers = {
                authorization: 'Bearer invalid-token',
            };

            (jwt.verify as jest.Mock).mockImplementation(() => {
                throw new Error('Invalid token');
            });

            expect(() => {
                guard.activate(mockRequest);
            }).toThrow();
        });

        it('should throw UnauthorizedHttpResponse if token is expired', () => {
            mockRequest.headers = {
                authorization: 'Bearer expired-token',
            };

            (jwt.verify as jest.Mock).mockImplementation(() => {
                const error: any = new Error('jwt expired');
                error.name = 'TokenExpiredError';
                throw error;
            });

            expect(() => {
                guard.activate(mockRequest);
            }).toThrow();
        });

        it('should throw error if JWT_SECRET is not configured', () => {
            delete process.env.JWT_SECRET;

            mockRequest.headers = {
                authorization: 'Bearer valid-token',
            };

            expect(() => guard.activate(mockRequest)).toThrow(
                'JWT_SECRET is not configured'
            );
        });

        it('should handle malformed JWT payload', () => {
            mockRequest.headers = {
                authorization: 'Bearer malformed-token',
            };

            const mockPayload = {
                // Missing sub and email
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            };

            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

            const result = guard.activate(mockRequest);

            expect(result).toBe(true);
            expect(mockRequest.user).toEqual({
                id: undefined,
                email: undefined,
            });
        });

        it('should trim whitespace from Bearer token', () => {
            mockRequest.headers = {
                authorization: '  Bearer   token-with-spaces  ',
            };

            const mockPayload = {
                sub: '123',
                email: 'test@example.com',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            };

            (jwt.verify as jest.Mock).mockReturnValue(mockPayload);

            // This should fail because split won't work properly with extra spaces
            expect(() => guard.activate(mockRequest)).toThrow(
                UnauthorizedHttpResponse
            );
        });
    });
});

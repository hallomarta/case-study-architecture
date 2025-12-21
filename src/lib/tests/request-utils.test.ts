import { getUser } from '../request-utils';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../types/AuthenticatedUser';

describe('request-utils', () => {
    describe('getUser', () => {
        it('should return user from request when user is present', () => {
            const mockUser: AuthenticatedUser = {
                id: 'user-123',
                email: 'test@example.com',
            };

            const mockRequest = {
                user: mockUser,
            } as Request;

            const result = getUser(mockRequest);

            expect(result).toBe(mockUser);
            expect(result.id).toBe('user-123');
            expect(result.email).toBe('test@example.com');
        });

        it('should throw error when user is not present in request', () => {
            const mockRequest = {} as Request;

            expect(() => getUser(mockRequest)).toThrow(
                'User not found in request. AuthGuard may not be applied.'
            );
        });
    });
});

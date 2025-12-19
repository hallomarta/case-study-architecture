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

describe('UserService', () => {
    let service: UserServiceImpl;
    let mockUserRepository: Mocked<UserRepository>;
    let mockPasswordManager: Mocked<PasswordManagerService>;

    beforeAll(async () => {
        const { unit, unitRef } = await TestBed.solitary(
            UserServiceImpl
        ).compile();

        service = unit;
        mockUserRepository = unitRef.get<UserRepository>(TOKEN.UserRepository);
        mockPasswordManager = unitRef.get<PasswordManagerService>(
            TOKEN.PasswordManagerService
        );

        // Mock JWT_SECRET
        process.env.JWT_SECRET = 'test-secret';
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

            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(mockUser);
            mockPasswordManager.compare.mockResolvedValue(true);

            const result = await service.authenticate(credentials);

            expect(result).toHaveProperty('access_token');
            expect(typeof result.access_token).toBe('string');
            expect(mockUserRepository.findByEmailWithIdentity).toHaveBeenCalledWith(
                credentials.email
            );
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

            mockUserRepository.findByEmailWithIdentity.mockResolvedValue(mockUser);
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
});

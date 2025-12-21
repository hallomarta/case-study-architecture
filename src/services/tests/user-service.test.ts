import { TestBed, type Mocked } from '@suites/unit';
import { UserServiceImpl } from '../user-service';
import type { UserRepository } from '../../repositories/user-repository';
import type { SafeUser } from '../../entities/user';
import type { PasswordManagerService } from '../password-manager-service';
import { TOKEN } from '../../lib/tokens';
import {
    ConflictHttpResponse,
    NotFoundHttpResponse,
} from '@inversifyjs/http-core';

describe('UserService', () => {
    let service: UserServiceImpl;
    let mockUserRepository: Mocked<UserRepository>;
    let mockPasswordManager: Mocked<PasswordManagerService>;

    beforeAll(async () => {
        const { unit, unitRef } =
            await TestBed.solitary(UserServiceImpl).compile();

        service = unit;
        mockUserRepository = unitRef.get<UserRepository>(TOKEN.UserRepository);
        mockPasswordManager = unitRef.get<PasswordManagerService>(
            TOKEN.PasswordManagerService
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

    describe('findById', () => {
        it('should return user when found', async () => {
            const mockUser: SafeUser = {
                id: '123',
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockUserRepository.findById.mockResolvedValue(mockUser);

            const result = await service.findById('123');

            expect(result).toEqual(mockUser);
            expect(mockUserRepository.findById).toHaveBeenCalledWith('123');
        });

        it('should throw NotFoundHttpResponse when user not found', async () => {
            mockUserRepository.findById.mockResolvedValue(null);

            await expect(service.findById('nonexistent')).rejects.toThrow(
                NotFoundHttpResponse
            );
            expect(mockUserRepository.findById).toHaveBeenCalledWith(
                'nonexistent'
            );
        });
    });

    describe('updateProfile', () => {
        it('should update user profile successfully', async () => {
            const userId = '123';
            const updateData = { firstName: 'Jane', lastName: 'Smith' };

            const existingUser: SafeUser = {
                id: userId,
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedUser: SafeUser = {
                ...existingUser,
                firstName: 'Jane',
                lastName: 'Smith',
                updatedAt: new Date(),
            };

            mockUserRepository.findById.mockResolvedValue(existingUser);
            mockUserRepository.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile(userId, updateData);

            expect(result.firstName).toBe('Jane');
            expect(result.lastName).toBe('Smith');
            expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
            expect(mockUserRepository.update).toHaveBeenCalledWith(
                userId,
                updateData
            );
        });

        it('should throw NotFoundHttpResponse if user not found', async () => {
            const userId = 'nonexistent';
            const updateData = { firstName: 'Jane' };

            mockUserRepository.findById.mockResolvedValue(null);

            await expect(
                service.updateProfile(userId, updateData)
            ).rejects.toThrow(NotFoundHttpResponse);
            expect(mockUserRepository.update).not.toHaveBeenCalled();
        });

        it('should update only firstName when provided', async () => {
            const userId = '123';
            const updateData = { firstName: 'Jane' };

            const existingUser: SafeUser = {
                id: userId,
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedUser: SafeUser = {
                ...existingUser,
                firstName: 'Jane',
                updatedAt: new Date(),
            };

            mockUserRepository.findById.mockResolvedValue(existingUser);
            mockUserRepository.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile(userId, updateData);

            expect(result.firstName).toBe('Jane');
            expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
                firstName: 'Jane',
            });
        });

        it('should update only lastName when provided', async () => {
            const userId = '123';
            const updateData = { lastName: 'Smith' };

            const existingUser: SafeUser = {
                id: userId,
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedUser: SafeUser = {
                ...existingUser,
                lastName: 'Smith',
                updatedAt: new Date(),
            };

            mockUserRepository.findById.mockResolvedValue(existingUser);
            mockUserRepository.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile(userId, updateData);

            expect(result.lastName).toBe('Smith');
            expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
                lastName: 'Smith',
            });
        });

        it('should not return identities in response', async () => {
            const userId = '123';
            const updateData = { firstName: 'Jane' };

            const existingUser: SafeUser = {
                id: userId,
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const updatedUser: SafeUser = {
                ...existingUser,
                firstName: 'Jane',
                updatedAt: new Date(),
            };

            mockUserRepository.findById.mockResolvedValue(existingUser);
            mockUserRepository.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile(userId, updateData);

            expect(result).not.toHaveProperty('identities');
        });
    });
});

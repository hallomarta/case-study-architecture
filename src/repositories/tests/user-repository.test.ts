import { TestBed, type Mocked } from '@suites/unit';
import { UserRepositoryImpl } from '../user-repository';
import type { SafeUser, UserWithIdentity } from '../../entities/user';
import type { PrismaClient } from '@prisma/client';
import { TOKEN } from '../../lib/tokens';

describe('UserRepository', () => {
    let repository: UserRepositoryImpl;
    let mockPrisma: Mocked<PrismaClient>;

    beforeAll(async () => {
        const { unit, unitRef } =
            await TestBed.solitary(UserRepositoryImpl).compile();
        repository = unit;
        mockPrisma = unitRef.get<PrismaClient>(TOKEN.PrismaClient);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findByEmail', () => {
        it('should find user by email WITHOUT identities', async () => {
            const mockUser: SafeUser = {
                id: '1',
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await repository.findByEmail('test@example.com');

            expect(result).toEqual(mockUser);
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { email: 'test@example.com' },
            });
        });

        it('should return null when user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const result = await repository.findByEmail(
                'nonexistent@example.com'
            );

            expect(result).toBeNull();
        });
    });

    describe('findByEmailWithIdentity', () => {
        it('should find user by email WITH identities', async () => {
            const mockUser: UserWithIdentity = {
                id: '1',
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
                identities: [
                    {
                        id: '1',
                        userId: '1',
                        provider: 'username-password',
                        passwordHash: 'hashed_password',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        lastLoginAt: null,
                    },
                ],
            };

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);

            const result =
                await repository.findByEmailWithIdentity('test@example.com');

            expect(result).toEqual(mockUser);
            expect(result?.identities).toBeDefined();
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { email: 'test@example.com' },
                include: { identities: true },
            });
        });

        it('should return null when user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const result = await repository.findByEmailWithIdentity(
                'nonexistent@example.com'
            );

            expect(result).toBeNull();
        });

        it('should return null when user has no identities', async () => {
            const mockUserWithoutIdentities = {
                id: '1',
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
                identities: [],
            };

            mockPrisma.user.findUnique.mockResolvedValue(
                mockUserWithoutIdentities
            );

            const result =
                await repository.findByEmailWithIdentity('test@example.com');

            expect(result).toBeNull();
        });
    });

    describe('findById', () => {
        it('should find user by id WITHOUT identities', async () => {
            const mockUser: SafeUser = {
                id: '123',
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await repository.findById('123');

            expect(result).toEqual(mockUser);
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: '123' },
            });
        });

        it('should return null when user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const result = await repository.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('findByIdWithIdentity', () => {
        it('should find user by id WITH identities', async () => {
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

            mockPrisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await repository.findByIdWithIdentity('123');

            expect(result).toEqual(mockUser);
            expect(result?.identities).toBeDefined();
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: '123' },
                include: { identities: true },
            });
        });

        it('should return null when user not found', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const result = await repository.findByIdWithIdentity('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null when user has no identities', async () => {
            const mockUserWithoutIdentities = {
                id: '123',
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
                createdAt: new Date(),
                updatedAt: new Date(),
                identities: [],
            };

            mockPrisma.user.findUnique.mockResolvedValue(
                mockUserWithoutIdentities
            );

            const result = await repository.findByIdWithIdentity('123');

            expect(result).toBeNull();
        });
    });

    describe('exists', () => {
        it('should return true when user exists', async () => {
            mockPrisma.user.count.mockResolvedValue(1);

            const result = await repository.exists('test@example.com');

            expect(result).toBe(true);
            expect(mockPrisma.user.count).toHaveBeenCalledWith({
                where: { email: 'test@example.com' },
            });
        });

        it('should return false when user does not exist', async () => {
            mockPrisma.user.count.mockResolvedValue(0);

            const result = await repository.exists('nonexistent@example.com');

            expect(result).toBe(false);
        });
    });

    describe('create', () => {
        it('should create user with identity and return WITHOUT identities', async () => {
            const createData = {
                email: 'new@example.com',
                firstName: 'Jane',
                lastName: 'Smith',
                password: 'hashed_password',
            };

            const mockCreatedUser: SafeUser = {
                id: '456',
                email: createData.email,
                firstName: createData.firstName,
                lastName: createData.lastName,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            mockPrisma.user.create.mockResolvedValue(mockCreatedUser);

            const result = await repository.create(createData);

            expect(result).toEqual(mockCreatedUser);
            expect(result).not.toHaveProperty('identities');
            expect(mockPrisma.user.create).toHaveBeenCalledWith({
                data: {
                    email: createData.email,
                    firstName: createData.firstName,
                    lastName: createData.lastName,
                    identities: {
                        create: {
                            provider: 'username-password',
                            passwordHash: createData.password,
                        },
                    },
                },
            });
        });
    });

    describe('update', () => {
        it('should update user data and return WITHOUT identities', async () => {
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

            mockPrisma.user.update.mockResolvedValue(mockUpdatedUser);

            const result = await repository.update('123', updateData);

            expect(result).toEqual(mockUpdatedUser);
            expect(result).not.toHaveProperty('identities');
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: '123' },
                data: updateData,
            });
        });

        it('should update only provided fields', async () => {
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

            mockPrisma.user.update.mockResolvedValue(mockUpdatedUser);

            const result = await repository.update('123', updateData);

            expect(result).toEqual(mockUpdatedUser);
            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: '123' },
                data: updateData,
            });
        });
    });
});

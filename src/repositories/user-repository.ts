import { inject, injectable } from 'inversify';
import type { PrismaClient } from '@prisma/client';
import type { SafeUser, UserWithIdentity } from '../entities/user';
import { TOKEN } from '../lib/tokens';

export interface CreateUserData {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
}

export interface UpdateUserData {
    firstName?: string;
    lastName?: string;
}

/**
 * Repository for User data access.
 *
 * SECURITY NOTE: By default, methods return users WITHOUT identity information
 * to prevent accidental leakage of password hashes. Use explicit methods
 * (e.g., findByEmailWithIdentity) when you need authentication data.
 */
export interface UserRepository {
    /**
     * Find user by email WITHOUT identity information (safe for general use)
     */
    findByEmail(email: string): Promise<SafeUser | null>;

    /**
     * Find user by email WITH identity information (contains password hash - use only for authentication)
     */
    findByEmailWithIdentity(email: string): Promise<UserWithIdentity | null>;

    /**
     * Find user by ID WITHOUT identity information (safe for general use)
     */
    findById(id: string): Promise<SafeUser | null>;

    /**
     * Find user by ID WITH identity information (contains password hash - use only for authentication)
     */
    findByIdWithIdentity(id: string): Promise<UserWithIdentity | null>;

    /**
     * Create a new user with username-password identity
     * Returns user WITHOUT identity information for security
     */
    create(data: CreateUserData): Promise<SafeUser>;

    /**
     * Update user profile information
     * Returns user WITHOUT identity information
     */
    update(id: string, data: UpdateUserData): Promise<SafeUser>;

    /**
     * Check if a user exists by email (efficient for existence checks)
     */
    exists(email: string): Promise<boolean>;

    /**
     * Update the password hash for a user's identity.
     * Used for password reset flow.
     * @param userId - User ID
     * @param passwordHash - New hashed password
     */
    updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}

@injectable()
export class UserRepositoryImpl implements UserRepository {
    constructor(@inject(TOKEN.PrismaClient) private prisma: PrismaClient) {}

    async findByEmail(email: string): Promise<SafeUser | null> {
        return this.prisma.user.findUnique({
            where: { email },
            // Explicitly exclude identities for security
        });
    }

    async findByEmailWithIdentity(
        email: string
    ): Promise<UserWithIdentity | null> {
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { identities: true },
        });

        // Ensure identities are present, otherwise return null
        if (!user || !user.identities || user.identities.length === 0) {
            return null;
        }

        return user as UserWithIdentity;
    }

    async findById(id: string): Promise<SafeUser | null> {
        return this.prisma.user.findUnique({
            where: { id },
            // Explicitly exclude identities for security
        });
    }

    async findByIdWithIdentity(id: string): Promise<UserWithIdentity | null> {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { identities: true },
        });

        // Ensure identities are present, otherwise return null
        if (!user || !user.identities || user.identities.length === 0) {
            return null;
        }

        return user as UserWithIdentity;
    }

    async create(data: CreateUserData): Promise<SafeUser> {
        const { password, ...userData } = data;

        return this.prisma.user.create({
            data: {
                ...userData,
                identities: {
                    create: {
                        provider: 'username-password',
                        passwordHash: password,
                    },
                },
            },
            // Return user without identities for security
        });
    }

    async update(id: string, data: UpdateUserData): Promise<SafeUser> {
        return this.prisma.user.update({
            where: { id },
            data,
            // Return user without identities for security
        });
    }

    async exists(email: string): Promise<boolean> {
        const count = await this.prisma.user.count({
            where: { email },
        });
        return count > 0;
    }

    async updatePasswordHash(
        userId: string,
        passwordHash: string
    ): Promise<void> {
        await this.prisma.userIdentity.updateMany({
            where: {
                userId,
                provider: 'username-password',
            },
            data: { passwordHash },
        });
    }
}

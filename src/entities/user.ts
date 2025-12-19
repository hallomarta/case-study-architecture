import type { User as PrismaUser, UserIdentity } from '@prisma/client';

// Export the Prisma User type with optional identities relation
export type User = PrismaUser & {
    identities?: UserIdentity[];
};

/**
 * Safe user type without sensitive identity data.
 * Use this type for API responses and general application logic.
 */
export type SafeUser = Omit<User, 'identities'>;

/**
 * User with identity information (contains password hashes).
 * Use ONLY for authentication flows where password verification is needed.
 */
export type UserWithIdentity = User & {
    identities: UserIdentity[];
};

// DTOs for creating/updating users
export interface CreateUserDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface UpdateUserDto {
    firstName?: string;
    lastName?: string;
}

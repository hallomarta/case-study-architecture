import type { User as PrismaUser } from '@prisma/client';

// Export the Prisma User type for use throughout the application
export type User = PrismaUser;

// You can also create DTOs for creating/updating users
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

import prisma from '../../src/lib/prisma';

/**
 * Clean up database before/after tests
 */
export async function cleanDatabase(): Promise<void> {
    // Delete in correct order due to foreign key constraints
    await prisma.userIdentity.deleteMany({});
    await prisma.user.deleteMany({});
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
}

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
    await prisma.$connect();
}

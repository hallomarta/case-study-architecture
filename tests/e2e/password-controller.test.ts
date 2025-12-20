import request from 'supertest';
import crypto from 'crypto';
import { Application } from 'express';
import { getApp } from '../../src/lib/app';
import { cleanDatabase, disconnectDatabase } from '../helpers/database';
import prisma from '../../src/lib/prisma';
import { passwordResetRateLimitStore, rateLimitStore } from '../../src/middleware/rate-limit-middleware';

/**
 * Helper to login via OAuth token endpoint
 */
async function login(
    app: Application,
    email: string,
    password: string
): Promise<request.Response> {
    return request(app).post('/oauth/token').send({
        grant_type: 'password',
        username: email,
        password,
    });
}

/**
 * Helper to refresh token via OAuth token endpoint
 */
async function refreshTokenRequest(
    app: Application,
    refreshToken: string
): Promise<request.Response> {
    return request(app).post('/oauth/token').send({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
}

describe('Password Reset E2E Tests', () => {
    let app: Application;

    beforeAll(async () => {
        app = await getApp();
    });

    beforeEach(async () => {
        await cleanDatabase();
        passwordResetRateLimitStore.resetAll();
        rateLimitStore.resetAll();
    });

    afterAll(async () => {
        await cleanDatabase();
        await disconnectDatabase();
    });

    /**
     * Helper to register a user for testing
     */
    async function registerUser(email: string = 'test@example.com') {
        const response = await request(app).post('/users/register').send({
            email,
            password: 'Test123456',
            firstName: 'John',
            lastName: 'Doe',
        });
        return response.body;
    }

    /**
     * Helper to get the most recent password reset token from the database
     */
    async function getLatestResetToken(userId: string) {
        return prisma.passwordResetToken.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Helper to create a raw token and its hash (simulating what the service does)
     */
    function createTokenPair() {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        return { token, tokenHash };
    }

    describe('POST /password/forgot', () => {
        it('should return success message for existing email', async () => {
            await registerUser('test@example.com');

            const response = await request(app)
                .post('/password/forgot')
                .send({ email: 'test@example.com' })
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain(
                'If that email address is in our database'
            );
        });

        it('should return same success message for non-existent email (prevent enumeration)', async () => {
            const response = await request(app)
                .post('/password/forgot')
                .send({ email: 'nonexistent@example.com' })
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain(
                'If that email address is in our database'
            );
        });

        it('should create a password reset token in the database', async () => {
            const user = await registerUser('test@example.com');

            await request(app)
                .post('/password/forgot')
                .send({ email: 'test@example.com' })
                .expect(200);

            const token = await getLatestResetToken(user.id);
            expect(token).not.toBeNull();
            expect(token?.tokenHash).toBeDefined();
            expect(token?.usedAt).toBeNull();
            expect(new Date(token!.expiresAt).getTime()).toBeGreaterThan(
                Date.now()
            );
        });

        it('should invalidate previous reset tokens when requesting a new one', async () => {
            const user = await registerUser('test@example.com');

            // Request first reset
            await request(app)
                .post('/password/forgot')
                .send({ email: 'test@example.com' })
                .expect(200);

            const firstToken = await getLatestResetToken(user.id);

            // Request second reset
            await request(app)
                .post('/password/forgot')
                .send({ email: 'test@example.com' })
                .expect(200);

            // First token should now be marked as used
            const updatedFirstToken = await prisma.passwordResetToken.findUnique({
                where: { id: firstToken!.id },
            });
            expect(updatedFirstToken?.usedAt).not.toBeNull();

            // Second token should be valid
            const secondToken = await getLatestResetToken(user.id);
            expect(secondToken?.usedAt).toBeNull();
            expect(secondToken?.id).not.toBe(firstToken?.id);
        });

        it('should fail with invalid email format', async () => {
            const response = await request(app)
                .post('/password/forgot')
                .send({ email: 'invalid-email' })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with missing email', async () => {
            const response = await request(app)
                .post('/password/forgot')
                .send({})
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should normalize email to lowercase', async () => {
            const user = await registerUser('test@example.com');

            await request(app)
                .post('/password/forgot')
                .send({ email: 'TEST@EXAMPLE.COM' })
                .expect(200);

            const token = await getLatestResetToken(user.id);
            expect(token).not.toBeNull();
        });
    });

    describe('POST /password/reset', () => {
        it('should reset password with valid token', async () => {
            const user = await registerUser('test@example.com');

            // Request password reset
            await request(app)
                .post('/password/forgot')
                .send({ email: 'test@example.com' })
                .expect(200);

            // Get the token hash from database and reverse-engineer the token
            // Note: In real tests, we'd intercept the email. Here we create a known token.
            const { token, tokenHash } = createTokenPair();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            // Manually insert a token we know
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                },
            });

            // Reset password
            const response = await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword123',
                })
                .expect(200);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('successfully');

            // Verify can login with new password
            const loginResponse = await login(
                app,
                'test@example.com',
                'NewPassword123'
            );

            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body).toHaveProperty('access_token');
        });

        it('should fail with invalid token', async () => {
            const response = await request(app)
                .post('/password/reset')
                .send({
                    token: 'invalid-token-that-does-not-exist',
                    newPassword: 'NewPassword123',
                });

            expect(response.status).toBe(500);
        });

        it('should fail with expired token', async () => {
            const user = await registerUser('test@example.com');

            const { token, tokenHash } = createTokenPair();
            const expiredAt = new Date(Date.now() - 1000); // Already expired

            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt: expiredAt,
                },
            });

            const response = await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword123',
                });

            expect(response.status).toBe(500);
        });

        it('should fail with already used token', async () => {
            const user = await registerUser('test@example.com');

            const { token, tokenHash } = createTokenPair();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                    usedAt: new Date(), // Already used
                },
            });

            const response = await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword123',
                });

            expect(response.status).toBe(500);
        });

        it('should mark token as used after successful reset', async () => {
            const user = await registerUser('test@example.com');

            const { token, tokenHash } = createTokenPair();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            const createdToken = await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                },
            });

            await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword123',
                })
                .expect(200);

            const updatedToken = await prisma.passwordResetToken.findUnique({
                where: { id: createdToken.id },
            });
            expect(updatedToken?.usedAt).not.toBeNull();
        });

        it('should revoke all refresh tokens after password reset', async () => {
            const user = await registerUser('test@example.com');

            // Login to get a refresh token
            const loginResponse = await login(
                app,
                'test@example.com',
                'Test123456'
            );

            expect(loginResponse.status).toBe(200);
            const refreshToken = loginResponse.body.refresh_token;

            // Verify refresh token works
            const verifyRefresh = await refreshTokenRequest(app, refreshToken);
            expect(verifyRefresh.status).toBe(200);

            // Reset password
            const { token, tokenHash } = createTokenPair();
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            });

            await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword123',
                })
                .expect(200);

            // Old refresh token should no longer work
            const refreshResponse = await refreshTokenRequest(
                app,
                refreshToken
            );

            expect(refreshResponse.status).toBe(401);
            expect(refreshResponse.body).toHaveProperty('message');
        });

        it('should fail with weak password (no uppercase)', async () => {
            const user = await registerUser('test@example.com');

            const { token, tokenHash } = createTokenPair();
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            });

            const response = await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'newpassword123',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with weak password (no lowercase)', async () => {
            const user = await registerUser('test@example.com');

            const { token, tokenHash } = createTokenPair();
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            });

            const response = await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'NEWPASSWORD123',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with weak password (no number)', async () => {
            const user = await registerUser('test@example.com');

            const { token, tokenHash } = createTokenPair();
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            });

            const response = await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with password too short', async () => {
            const user = await registerUser('test@example.com');

            const { token, tokenHash } = createTokenPair();
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            });

            const response = await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'New1',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with missing token', async () => {
            const response = await request(app)
                .post('/password/reset')
                .send({
                    newPassword: 'NewPassword123',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with missing newPassword', async () => {
            const response = await request(app)
                .post('/password/reset')
                .send({
                    token: 'some-token',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should not allow login with old password after reset', async () => {
            const user = await registerUser('test@example.com');

            const { token, tokenHash } = createTokenPair();
            await prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            });

            await request(app)
                .post('/password/reset')
                .send({
                    token,
                    newPassword: 'NewPassword123',
                })
                .expect(200);

            // Old password should not work
            const loginResponse = await login(
                app,
                'test@example.com',
                'Test123456'
            );

            expect(loginResponse.status).toBe(401);
            expect(loginResponse.body).toHaveProperty('message');
        });
    });
});

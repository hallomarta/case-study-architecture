import request from 'supertest';
import { Application } from 'express';
import { getApp } from '../../src/lib/app';
import { cleanDatabase, disconnectDatabase } from '../helpers/database';
import { rateLimitStore } from '../../src/middleware/rate-limit-middleware';
import { login, refreshToken, registerUser } from './helpers/auth-helpers';

describe('OAuthController E2E Tests', () => {
    let app: Application;

    beforeAll(async () => {
        app = await getApp();
    });

    beforeEach(async () => {
        await cleanDatabase();
        // Reset rate limit store between tests
        rateLimitStore.resetAll();
    });

    afterAll(async () => {
        await cleanDatabase();
        await disconnectDatabase();
    });

    describe('POST /oauth/token (password grant)', () => {
        beforeEach(async () => {
            // Create a test user
            await registerUser(app);
        });

        it('should login with valid credentials', async () => {
            const response = await login(app, 'test@example.com', 'Test123456');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('access_token');
            expect(response.body).toHaveProperty('refresh_token');
            expect(response.body).toHaveProperty('id_token');
            expect(response.body).toHaveProperty('token_type', 'Bearer');
            expect(response.body).toHaveProperty('expires_in');
            expect(typeof response.body.access_token).toBe('string');
            expect(typeof response.body.refresh_token).toBe('string');
            expect(typeof response.body.id_token).toBe('string');
            expect(response.body.access_token.length).toBeGreaterThan(0);
            expect(response.body.refresh_token.length).toBeGreaterThan(0);
            expect(response.body.id_token.length).toBeGreaterThan(0);
        });

        it('should fail with invalid email', async () => {
            const response = await login(
                app,
                'wrong@example.com',
                'Test123456'
            );

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Invalid email or password');
        });

        it('should fail with invalid password', async () => {
            const response = await login(
                app,
                'test@example.com',
                'WrongPassword123'
            );

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Invalid email or password');
        });

        it('should fail with missing credentials', async () => {
            const response = await request(app).post('/oauth/token').send({
                grant_type: 'password',
                username: 'test@example.com',
            });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message');
        });

        it('should rate limit after too many failed login attempts', async () => {
            // Make 5 failed login attempts (the limit)
            for (let i = 0; i < 5; i++) {
                await login(app, 'test@example.com', 'WrongPassword123');
            }

            // The 6th attempt should be rate limited
            const response = await login(
                app,
                'test@example.com',
                'WrongPassword123'
            );

            expect(response.status).toBe(429);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Too many login attempts');
        });
    });

    describe('POST /oauth/token (refresh_token grant)', () => {
        let currentRefreshToken: string;

        beforeEach(async () => {
            // Register and login to get tokens
            await registerUser(app);
            const loginResponse = await login(app, 'test@example.com', 'Test123456');
            currentRefreshToken = loginResponse.body.refresh_token;
        });

        it('should refresh access token with valid refresh token', async () => {
            const response = await refreshToken(app, currentRefreshToken);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('access_token');
            expect(response.body).toHaveProperty('refresh_token');
            expect(response.body).toHaveProperty('id_token');
            expect(response.body).toHaveProperty('token_type', 'Bearer');
            expect(response.body.refresh_token).not.toBe(currentRefreshToken); // Token rotation
        });

        it('should fail with invalid refresh token', async () => {
            const response = await refreshToken(app, 'invalid-token');

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });

        it('should fail with missing refresh token', async () => {
            const response = await request(app).post('/oauth/token').send({
                grant_type: 'refresh_token',
            });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('message');
        });

        it('should not allow reuse of rotated refresh token', async () => {
            // First refresh - should succeed
            const firstRefresh = await refreshToken(app, currentRefreshToken);
            expect(firstRefresh.status).toBe(200);

            // Second refresh with same token - should fail (token was rotated)
            const response = await refreshToken(app, currentRefreshToken);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });

        it('should invalidate entire token family when reuse is detected', async () => {
            // Step 1: First refresh - legitimate client gets new token pair
            const firstRefresh = await refreshToken(app, currentRefreshToken);

            expect(firstRefresh.status).toBe(200);
            const newRefreshToken = firstRefresh.body.refresh_token;
            expect(newRefreshToken).not.toBe(currentRefreshToken);

            // Step 2: Attacker tries to use the stolen (old) token
            // This should trigger family invalidation
            const attackerRefresh = await refreshToken(app, currentRefreshToken);
            expect(attackerRefresh.status).toBe(401);

            // Step 3: Legitimate client's new token should now also be invalid
            // because the entire token family was invalidated
            const response = await refreshToken(app, newRefreshToken);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });
    });

    describe('POST /oauth/revoke', () => {
        let accessToken: string;
        let currentRefreshToken: string;

        beforeEach(async () => {
            // Register and login to get tokens
            await registerUser(app);
            const loginResponse = await login(app, 'test@example.com', 'Test123456');
            accessToken = loginResponse.body.access_token;
            currentRefreshToken = loginResponse.body.refresh_token;
        });

        it('should logout and invalidate refresh token', async () => {
            // Logout (revoke token)
            await request(app)
                .post('/oauth/revoke')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ refresh_token: currentRefreshToken })
                .expect(200);

            // Try to refresh with revoked token
            const response = await refreshToken(app, currentRefreshToken);

            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });

        it('should fail without authorization token', async () => {
            const response = await request(app)
                .post('/oauth/revoke')
                .send({ refresh_token: currentRefreshToken });

            expect(response.status).toBe(401);
        });
    });

    describe('POST /oauth/revoke-all', () => {
        let accessToken: string;
        let refreshToken1: string;
        let refreshToken2: string;

        beforeEach(async () => {
            // Register user
            await registerUser(app);

            // Login twice to simulate multiple devices
            const login1 = await login(app, 'test@example.com', 'Test123456');
            const login2 = await login(app, 'test@example.com', 'Test123456');

            accessToken = login1.body.access_token;
            refreshToken1 = login1.body.refresh_token;
            refreshToken2 = login2.body.refresh_token;
        });

        it('should logout from all devices', async () => {
            // Logout all (revoke all sessions)
            const logoutResponse = await request(app)
                .post('/oauth/revoke-all')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(logoutResponse.status).toBe(200);

            // Both refresh tokens should be invalid
            const refresh1 = await refreshToken(app, refreshToken1);
            expect(refresh1.status).toBe(401);

            const refresh2 = await refreshToken(app, refreshToken2);
            expect(refresh2.status).toBe(401);
        });

        it('should fail without authorization token', async () => {
            const response = await request(app).post('/oauth/revoke-all');

            expect(response.status).toBe(401);
        });
    });
});

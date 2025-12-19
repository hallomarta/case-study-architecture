import request from 'supertest';
import { Application } from 'express';
import { getApp } from '../../src/lib/app';
import { cleanDatabase, disconnectDatabase } from '../helpers/database';
import { rateLimitStore } from '../../src/middleware/rate-limit-middleware';

describe('User Authentication E2E Tests', () => {
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

    describe('POST /users/register', () => {
        it('should register a new user with valid data', async () => {
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                    firstName: 'John',
                    lastName: 'Doe',
                })
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('email', 'test@example.com');
            expect(response.body).toHaveProperty('firstName', 'John');
            expect(response.body).toHaveProperty('lastName', 'Doe');
            expect(response.body).toHaveProperty('createdAt');
            expect(response.body).toHaveProperty('updatedAt');
            expect(response.body).not.toHaveProperty('identities');
            expect(response.body).not.toHaveProperty('password');
        });

        it('should fail with invalid email format', async () => {
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'invalid-email',
                    password: 'Test123456',
                    firstName: 'John',
                    lastName: 'Doe',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with weak password (no uppercase)', async () => {
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'test123456',
                    firstName: 'John',
                    lastName: 'Doe',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with weak password (no lowercase)', async () => {
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'TEST123456',
                    firstName: 'John',
                    lastName: 'Doe',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with weak password (no number)', async () => {
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'TestPassword',
                    firstName: 'John',
                    lastName: 'Doe',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with password too short', async () => {
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123',
                    firstName: 'John',
                    lastName: 'Doe',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with missing required fields', async () => {
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail when registering duplicate email', async () => {
            // First registration
            await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                    firstName: 'John',
                    lastName: 'Doe',
                })
                .expect(201);

            // Duplicate registration
            const response = await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                    firstName: 'Jane',
                    lastName: 'Smith',
                })
                .expect(409);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('already exists');
        });
    });

    describe('POST /users/login', () => {
        beforeEach(async () => {
            // Create a test user
            await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                    firstName: 'John',
                    lastName: 'Doe',
                });
        });

        it('should login with valid credentials', async () => {
            const response = await request(app)
                .post('/users/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                })
                .expect(200);

            expect(response.body).toHaveProperty('access_token');
            expect(typeof response.body.access_token).toBe('string');
            expect(response.body.access_token.length).toBeGreaterThan(0);
        });

        it('should fail with invalid email', async () => {
            const response = await request(app)
                .post('/users/login')
                .send({
                    email: 'wrong@example.com',
                    password: 'Test123456',
                })
                .expect(401);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Invalid email or password');
        });

        it('should fail with invalid password', async () => {
            const response = await request(app)
                .post('/users/login')
                .send({
                    email: 'test@example.com',
                    password: 'WrongPassword123',
                })
                .expect(401);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Invalid email or password');
        });

        it('should fail with missing credentials', async () => {
            const response = await request(app)
                .post('/users/login')
                .send({
                    email: 'test@example.com',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should rate limit after too many failed login attempts', async () => {
            // Make 5 failed login attempts (the limit)
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post('/users/login')
                    .send({
                        email: 'test@example.com',
                        password: 'WrongPassword123',
                    });
            }

            // The 6th attempt should be rate limited
            const response = await request(app)
                .post('/users/login')
                .send({
                    email: 'test@example.com',
                    password: 'WrongPassword123',
                })
                .expect(429);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Too many login attempts');
        });
    });

    describe('GET /users/profile', () => {
        let accessToken: string;

        beforeEach(async () => {
            // Register and login to get token
            await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                    firstName: 'John',
                    lastName: 'Doe',
                });

            const loginResponse = await request(app)
                .post('/users/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                });

            accessToken = loginResponse.body.access_token;
        });

        it('should get user profile with valid token', async () => {
            const response = await request(app)
                .get('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('email', 'test@example.com');
            expect(response.body).toHaveProperty('firstName', 'John');
            expect(response.body).toHaveProperty('lastName', 'Doe');
            expect(response.body).not.toHaveProperty('identities');
            expect(response.body).not.toHaveProperty('password');
        });

        it('should fail without authorization token', async () => {
            const response = await request(app)
                .get('/users/profile')
                .expect(401);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Authorization token required');
        });

        it('should fail with invalid token', async () => {
            const response = await request(app)
                .get('/users/profile')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toContain('Invalid token');
        });

        it('should fail with malformed authorization header', async () => {
            const response = await request(app)
                .get('/users/profile')
                .set('Authorization', 'InvalidFormat token')
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('PUT /users/profile', () => {
        let accessToken: string;

        beforeEach(async () => {
            // Register and login to get token
            await request(app)
                .post('/users/register')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                    firstName: 'John',
                    lastName: 'Doe',
                });

            const loginResponse = await request(app)
                .post('/users/login')
                .send({
                    email: 'test@example.com',
                    password: 'Test123456',
                });

            accessToken = loginResponse.body.access_token;
        });

        it('should update user profile with valid data', async () => {
            const response = await request(app)
                .put('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    firstName: 'Jane',
                    lastName: 'Smith',
                })
                .expect(200);

            expect(response.body).toHaveProperty('firstName', 'Jane');
            expect(response.body).toHaveProperty('lastName', 'Smith');
            expect(response.body).toHaveProperty('email', 'test@example.com');
            expect(response.body).not.toHaveProperty('identities');
        });

        it('should update only firstName', async () => {
            const response = await request(app)
                .put('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    firstName: 'Jane',
                })
                .expect(200);

            expect(response.body).toHaveProperty('firstName', 'Jane');
            expect(response.body).toHaveProperty('lastName', 'Doe');
        });

        it('should update only lastName', async () => {
            const response = await request(app)
                .put('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    lastName: 'Smith',
                })
                .expect(200);

            expect(response.body).toHaveProperty('firstName', 'John');
            expect(response.body).toHaveProperty('lastName', 'Smith');
        });

        it('should fail without authorization token', async () => {
            const response = await request(app)
                .put('/users/profile')
                .send({
                    firstName: 'Jane',
                    lastName: 'Smith',
                })
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with invalid token', async () => {
            const response = await request(app)
                .put('/users/profile')
                .set('Authorization', 'Bearer invalid-token')
                .send({
                    firstName: 'Jane',
                    lastName: 'Smith',
                })
                .expect(401);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with empty firstName', async () => {
            const response = await request(app)
                .put('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    firstName: '',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });

        it('should fail with empty lastName', async () => {
            const response = await request(app)
                .put('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    lastName: '',
                })
                .expect(400);

            expect(response.body).toHaveProperty('message');
        });
    });

    describe('Full User Flow E2E', () => {
        it('should complete full user lifecycle: register -> login -> get profile -> update profile', async () => {
            // 1. Register
            const registerResponse = await request(app)
                .post('/users/register')
                .send({
                    email: 'fullflow@example.com',
                    password: 'FullFlow123',
                    firstName: 'Test',
                    lastName: 'User',
                })
                .expect(201);

            expect(registerResponse.body.email).toBe('fullflow@example.com');
            const userId = registerResponse.body.id;

            // 2. Login
            const loginResponse = await request(app)
                .post('/users/login')
                .send({
                    email: 'fullflow@example.com',
                    password: 'FullFlow123',
                })
                .expect(200);

            expect(loginResponse.body).toHaveProperty('access_token');
            const accessToken = loginResponse.body.access_token;

            // 3. Get Profile
            const profileResponse = await request(app)
                .get('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(profileResponse.body.id).toBe(userId);
            expect(profileResponse.body.email).toBe('fullflow@example.com');
            expect(profileResponse.body.firstName).toBe('Test');
            expect(profileResponse.body.lastName).toBe('User');

            // 4. Update Profile
            const updateResponse = await request(app)
                .put('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    firstName: 'Updated',
                    lastName: 'Name',
                })
                .expect(200);

            expect(updateResponse.body.id).toBe(userId);
            expect(updateResponse.body.firstName).toBe('Updated');
            expect(updateResponse.body.lastName).toBe('Name');

            // 5. Verify updated profile
            const verifyResponse = await request(app)
                .get('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(verifyResponse.body.firstName).toBe('Updated');
            expect(verifyResponse.body.lastName).toBe('Name');
        });
    });
});

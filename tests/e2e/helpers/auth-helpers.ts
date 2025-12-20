import request from 'supertest';
import { Application } from 'express';

/**
 * Helper to login via OAuth token endpoint
 */
export async function login(
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
export async function refreshToken(
    app: Application,
    refreshTokenValue: string
): Promise<request.Response> {
    return request(app).post('/oauth/token').send({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenValue,
    });
}

/**
 * Helper to register a user
 */
export async function registerUser(
    app: Application,
    email: string = 'test@example.com',
    password: string = 'Test123456',
    firstName: string = 'John',
    lastName: string = 'Doe'
): Promise<request.Response> {
    return request(app).post('/users/register').send({
        email,
        password,
        firstName,
        lastName,
    });
}

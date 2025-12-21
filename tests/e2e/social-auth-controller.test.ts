import request from 'supertest';
import { Application } from 'express';
import { getApp } from '../../src/lib/app';
import { cleanDatabase, disconnectDatabase } from '../helpers/database';

describe('Social Auth Controller E2E Tests', () => {
    let app: Application;

    beforeAll(async () => {
        app = await getApp();
    });

    beforeEach(async () => {
        await cleanDatabase();
    });

    afterAll(async () => {
        await cleanDatabase();
        await disconnectDatabase();
    });

    it('GET /oauth/authorize should return 501 Not Implemented', async () => {
        const response = await request(app)
            .get('/oauth/authorize')
            .query({ provider: 'google' });

        expect(response.status).toBe(501);
        expect(response.body).toMatchObject({
            error: 'not_implemented',
            error_description: expect.stringContaining(
                'OAuth authorization flow is not yet implemented'
            ),
            status: 501,
        });
    });

    it('GET /oauth/callback should return 501 Not Implemented', async () => {
        const response = await request(app)
            .get('/oauth/callback')
            .query({ code: 'abc123', state: 'state-token' });

        expect(response.status).toBe(501);
        expect(response.body).toMatchObject({
            error: 'not_implemented',
            error_description: expect.stringContaining(
                'OAuth callback handling is not yet implemented'
            ),
            status: 501,
        });
    });
});

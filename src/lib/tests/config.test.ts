import { createTestConfig, loadConfig } from '../config';

describe('config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('createTestConfig', () => {
        it('should create config with default test values', () => {
            const config = createTestConfig();

            expect(config).toMatchObject({
                port: 9000,
                databaseUrl: 'postgresql://test:test@localhost:5432/test',
                nodeEnv: 'test',
                logLevel: 'error',
                accessTokenSecret: 'test-jwt-secret-do-not-use-in-production',
                refreshTokenSecret:
                    'test-refresh-secret-do-not-use-in-production',
                accessTokenExpiresIn: 5000,
                refreshTokenExpiresIn: 10000,
                allowedOrigins: ['http://localhost:3000'],
            });
        });

        it('should allow overriding default values', () => {
            const config = createTestConfig({
                port: 8080,
                logLevel: 'debug',
                allowedOrigins: ['http://example.com', 'http://test.com'],
            });

            expect(config.port).toBe(8080);
            expect(config.logLevel).toBe('debug');
            expect(config.allowedOrigins).toEqual([
                'http://example.com',
                'http://test.com',
            ]);
            expect(config.nodeEnv).toBe('test');
        });
    });

    describe('loadConfig', () => {
        it('should use test log level for test environment', () => {
            process.env.NODE_ENV = 'test';
            process.env.DATABASE_URL =
                'postgresql://test:test@localhost:5432/test';
            process.env.JWT_SECRET = 'test-secret';
            process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
            process.env.JWT_EXPIRES_IN = '15m';
            process.env.JWT_REFRESH_EXPIRES_IN = '7d';

            const config = loadConfig();

            expect(config.logLevel).toBe('error');
        });

        it('should use production log level for production environment', () => {
            process.env.NODE_ENV = 'production';
            process.env.DATABASE_URL =
                'postgresql://prod:prod@localhost:5432/prod';
            process.env.JWT_SECRET = 'prod-secret';
            process.env.JWT_REFRESH_SECRET = 'prod-refresh-secret';
            process.env.JWT_EXPIRES_IN = '15m';
            process.env.JWT_REFRESH_EXPIRES_IN = '7d';

            const consoleWarnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation();

            const config = loadConfig();

            expect(config.logLevel).toBe('info');
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Running in production')
            );

            consoleWarnSpy.mockRestore();
        });

        it('should use development log level for development environment', () => {
            process.env.NODE_ENV = 'development';
            process.env.DATABASE_URL =
                'postgresql://dev:dev@localhost:5432/dev';
            process.env.JWT_SECRET = 'dev-secret';
            process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret';
            process.env.JWT_EXPIRES_IN = '15m';
            process.env.JWT_REFRESH_EXPIRES_IN = '7d';

            const config = loadConfig();

            expect(config.logLevel).toBe('debug');
        });

        it('should override log level when LOG_LEVEL is provided', () => {
            process.env.NODE_ENV = 'development';
            process.env.LOG_LEVEL = 'WARN';
            process.env.DATABASE_URL =
                'postgresql://dev:dev@localhost:5432/dev';
            process.env.JWT_SECRET = 'dev-secret';
            process.env.JWT_REFRESH_SECRET = 'dev-refresh-secret';
            process.env.JWT_EXPIRES_IN = '15m';
            process.env.JWT_REFRESH_EXPIRES_IN = '7d';

            const config = loadConfig();

            expect(config.logLevel).toBe('warn');
        });

        it('should parse duration strings correctly', () => {
            process.env.NODE_ENV = 'test';
            process.env.DATABASE_URL =
                'postgresql://test:test@localhost:5432/test';
            process.env.JWT_SECRET = 'test-secret';
            process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
            process.env.JWT_EXPIRES_IN = '1h';
            process.env.JWT_REFRESH_EXPIRES_IN = '7d';

            const config = loadConfig();

            expect(config.accessTokenExpiresIn).toBe(3600000); // 1 hour in ms
            expect(config.refreshTokenExpiresIn).toBe(604800000); // 7 days in ms
        });

        it('should parse multiple allowed origins', () => {
            process.env.NODE_ENV = 'test';
            process.env.DATABASE_URL =
                'postgresql://test:test@localhost:5432/test';
            process.env.JWT_SECRET = 'test-secret';
            process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
            process.env.JWT_EXPIRES_IN = '15m';
            process.env.JWT_REFRESH_EXPIRES_IN = '7d';
            process.env.ALLOWED_ORIGINS =
                'http://localhost:3000, http://example.com, http://test.com';

            const config = loadConfig();

            expect(config.allowedOrigins).toEqual([
                'http://localhost:3000',
                'http://example.com',
                'http://test.com',
            ]);
        });

        it('should apply overrides to loaded config', () => {
            process.env.NODE_ENV = 'test';
            process.env.DATABASE_URL =
                'postgresql://test:test@localhost:5432/test';
            process.env.JWT_SECRET = 'test-secret';
            process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
            process.env.JWT_EXPIRES_IN = '15m';
            process.env.JWT_REFRESH_EXPIRES_IN = '7d';

            const config = loadConfig({ port: 8080, logLevel: 'debug' });

            expect(config.port).toBe(8080);
            expect(config.logLevel).toBe('debug');
        });
    });
});

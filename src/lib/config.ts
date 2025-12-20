/**
 * Centralized Configuration Module
 *
 * This module provides validated, type-safe configuration for the application.
 * All environment variables are validated at startup using Zod, preventing the
 * app from running with missing or invalid configuration.
 *
 * Flow:
 * 1. Validate raw env vars (strings)
 * 2. Transform into final config object
 * 3. Validate final config shape
 *
 * Usage:
 *   // Via DI (recommended for services)
 *   constructor(@inject(TOKEN.Config) private config: Config) {}
 *
 *   // Direct import (for modules outside DI, like logger)
 *   import { config } from './config';
 */

import { config as dotenvConfig } from 'dotenv';
import ms from 'ms';
import { z } from 'zod';
import type { Config } from '../types/Config';

// Log level enum
const logLevelSchema = z.enum([
    'debug',
    'info',
    'warn',
    'error',
    'verbose',
    'http',
    'silly',
]);

// Node environment enum
const nodeEnvSchema = z.enum(['development', 'production', 'test']);

/**
 * Zod schema for raw environment variables - validation only, no transforms.
 */
const envSchema = z.object({
    PORT: z.string().default('9000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    NODE_ENV: nodeEnvSchema.default('development'),
    LOG_LEVEL: z.string().optional(),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
    JWT_EXPIRES_IN: z.string().min(1, 'JWT_EXPIRES_IN is required'),
    JWT_REFRESH_EXPIRES_IN: z
        .string()
        .min(1, 'JWT_REFRESH_EXPIRES_IN is required'),
    ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
});

/**
 * Zod schema for the final Config object.
 */
const configSchema = z.object({
    port: z.number().positive(),
    databaseUrl: z.string().min(1),
    nodeEnv: nodeEnvSchema,
    logLevel: logLevelSchema,
    accessTokenSecret: z.string().min(1),
    refreshTokenSecret: z.string().min(1),
    accessTokenExpiresIn: z.number().positive(),
    refreshTokenExpiresIn: z.number().positive(),
    allowedOrigins: z.array(z.string()).min(1),
});

/**
 * Get default log level based on NODE_ENV.
 */
function getDefaultLogLevel(
    nodeEnv: string
): 'debug' | 'info' | 'warn' | 'error' {
    switch (nodeEnv) {
    case 'production':
        return 'info';
    case 'test':
        return 'error';
    default:
        return 'debug';
    }
}

/**
 * Parse duration string to milliseconds.
 * @throws Error if invalid format
 */
function parseDuration(value: string, name: string): number {
    const result = ms(value as ms.StringValue);
    if (result === undefined) {
        throw new Error(
            `Invalid ${name} format: "${value}". Use formats like '15m', '1h', '7d'`
        );
    }
    return result;
}

/**
 * Formats Zod validation errors.
 */
function formatValidationErrors(error: z.ZodError): string {
    return error.issues
        .map(issue => {
            const path = issue.path.join('.');
            return `  - ${path}: ${issue.message}`;
        })
        .join('\n');
}

/**
 * Loads and validates configuration from environment variables.
 */
export function loadConfig(overrides?: Partial<Config>): Config {
    // Load .env file based on NODE_ENV
    const nodeEnv = process.env.NODE_ENV || 'development';
    dotenvConfig({ path: nodeEnv === 'test' ? '.env.test' : '.env' });

    // 1. Validate raw env vars
    const envResult = envSchema.safeParse(process.env);
    if (!envResult.success) {
        console.error('\n❌ Environment variable validation failed:\n');
        console.error(formatValidationErrors(envResult.error));
        process.exit(1);
    }

    const env = envResult.data;

    if (env.NODE_ENV === 'production') {
        console.warn(
            '⚠️  Running in production. Consider validating environment variables at build/deploy time.'
        );
    }

    // 2. Transform into config object
    const rawConfig = {
        port: Number(env.PORT),
        databaseUrl: env.DATABASE_URL,
        nodeEnv: env.NODE_ENV,
        logLevel: env.LOG_LEVEL
            ? (env.LOG_LEVEL.toLowerCase() as Config['logLevel'])
            : getDefaultLogLevel(env.NODE_ENV),
        accessTokenSecret: env.JWT_SECRET,
        refreshTokenSecret: env.JWT_REFRESH_SECRET,
        accessTokenExpiresIn: parseDuration(
            env.JWT_EXPIRES_IN,
            'JWT_EXPIRES_IN'
        ),
        refreshTokenExpiresIn: parseDuration(
            env.JWT_REFRESH_EXPIRES_IN,
            'JWT_REFRESH_EXPIRES_IN'
        ),
        allowedOrigins: env.ALLOWED_ORIGINS.split(',').map(s => s.trim()),
        ...overrides,
    };

    // 3. Validate final config shape
    const configResult = configSchema.safeParse(rawConfig);
    if (!configResult.success) {
        console.error('\n❌ Configuration validation failed:\n');
        console.error(formatValidationErrors(configResult.error));
        process.exit(1);
    }

    return configResult.data;
}

/**
 * Creates a test configuration with sensible defaults and optional overrides.
 * Does NOT load from .env files - provides complete isolation for unit tests.
 *
 * @param overrides - Partial config values to override defaults
 * @returns Config object with test-friendly defaults
 */
export function createTestConfig(overrides?: Partial<Config>): Config {
    return {
        port: 9000,
        databaseUrl: 'postgresql://test:test@localhost:5432/test',
        nodeEnv: 'test',
        logLevel: 'error',
        accessTokenSecret: 'test-jwt-secret-do-not-use-in-production',
        refreshTokenSecret: 'test-refresh-secret-do-not-use-in-production',
        accessTokenExpiresIn: 5000, // 5 seconds for fast test expiration
        refreshTokenExpiresIn: 10000, // 10 seconds
        allowedOrigins: ['http://localhost:3000'],
        ...overrides,
    };
}

// Export config - loaded once on first module import (module system provides singleton behavior)
export const config = loadConfig();

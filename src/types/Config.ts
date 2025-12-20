/**
 * Application configuration interface.
 *
 * All configuration values are validated at startup using Zod.
 * Expiration times are stored in milliseconds for easy Date calculations.
 */
export interface Config {
    /** Server port (default: 9000) */
    port: number;

    /** PostgreSQL connection string */
    databaseUrl: string;

    /** Environment: 'development' | 'production' | 'test' */
    nodeEnv: 'development' | 'production' | 'test';

    /** Log level override (default based on nodeEnv) */
    logLevel:
    | 'debug'
    | 'info'
    | 'warn'
    | 'error'
    | 'verbose'
    | 'http'
    | 'silly';

    /** Secret key for signing access tokens */
    accessTokenSecret: string;

    /** Secret key for signing refresh tokens */
    refreshTokenSecret: string;

    /** Access token expiration in milliseconds (default: 15 minutes) */
    accessTokenExpiresIn: number;

    /** Refresh token expiration in milliseconds (default: 7 days) */
    refreshTokenExpiresIn: number;

    /** Allowed CORS origins */
    allowedOrigins: string[];
}

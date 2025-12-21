import { ConsoleLogger, Logger, LogLevel } from '@inversifyjs/logger';
import { config } from './config';

/**
 * Logger Module
 *
 * This module provides a factory function to create logger instances.
 * It uses @inversifyjs/logger with ConsoleLogger as the default implementation,
 * typed against the Logger interface for easy swapping to FileLogger, StreamLogger, etc.
 *
 * Configuration is loaded from the centralized config module.
 *
 * Usage:
 *   import { createLogger } from '../lib/logger';
 *   const logger = createLogger('UserService');
 *   logger.info('User logged in', { userId: '123', action: 'LOGIN' });
 */

// Map string log levels to LogLevel enum
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR,
    verbose: LogLevel.VERBOSE,
    http: LogLevel.HTTP,
    silly: LogLevel.SILLY,
};

// Get all log levels at or above the specified level
function getLogLevels(minLevel: LogLevel): LogLevel[] {
    const allLevels = [
        LogLevel.ERROR,
        LogLevel.WARN,
        LogLevel.INFO,
        LogLevel.HTTP,
        LogLevel.VERBOSE,
        LogLevel.DEBUG,
        LogLevel.SILLY,
    ];

    // LogLevel values: ERROR=0, WARN=1, INFO=2, HTTP=3, VERBOSE=4, DEBUG=5, SILLY=6
    // Include all levels from ERROR up to and including minLevel
    return allLevels.filter(level => level <= minLevel);
}

/**
 * Creates a logger instance for a specific module/service.
 *
 * @param module - The name of the module, service, or file using this logger.
 *                 This will be included in all log output for traceability.
 * @returns A Logger instance configured for the current environment.
 *
 * @example
 * const logger = createLogger('UserService');
 * logger.info('User authenticated', { userId: 'abc123', method: 'password' });
 * logger.error('Authentication failed', { email: 'user@example.com', reason: 'invalid_password' });
 * logger.warn('Rate limit approaching', { userId: 'abc123', remaining: 5 });
 */
export function createLogger(module: string): Logger {
    // Config is already loaded from module import

    // Suppress all logs during tests
    if (config.nodeEnv === 'test') {
        return new ConsoleLogger(module, {
            logTypes: [], // No log types = no output
        });
    }

    const logLevel = LOG_LEVEL_MAP[config.logLevel] ?? LogLevel.INFO;

    const logger: Logger = new ConsoleLogger(module, {
        json: config.nodeEnv === 'production',
        timestamp: true,
        logTypes: getLogLevels(logLevel),
    });

    return logger;
}

// Re-export types for consumers
export type { Logger };
export { LogLevel };

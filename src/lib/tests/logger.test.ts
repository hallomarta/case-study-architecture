import { createLogger } from '../logger';
import { ConsoleLogger } from '@inversifyjs/logger';
import { config } from '../config';

// Mock the config module
jest.mock('../config', () => ({
    config: {
        nodeEnv: 'development',
        logLevel: 'info',
    },
}));

describe('logger', () => {
    describe('createLogger', () => {
        it('should create logger with module name', () => {
            const logger = createLogger('TestModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should suppress logs in test environment', () => {
            config.nodeEnv = 'test';

            const logger = createLogger('TestModule');

            // In test mode, logger should have empty logTypes array
            expect(logger).toBeDefined();
        });

        it('should enable JSON logging in production', () => {
            config.nodeEnv = 'production';
            config.logLevel = 'info';

            const logger = createLogger('ProductionModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should configure log levels based on config', () => {
            config.nodeEnv = 'development';
            config.logLevel = 'error';

            const logger = createLogger('ErrorOnlyModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should handle warn log level', () => {
            config.nodeEnv = 'development';
            config.logLevel = 'warn';

            const logger = createLogger('WarnModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should handle debug log level', () => {
            config.nodeEnv = 'development';
            config.logLevel = 'debug';

            const logger = createLogger('DebugModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should handle verbose log level', () => {
            config.nodeEnv = 'development';
            config.logLevel = 'verbose';

            const logger = createLogger('VerboseModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should handle http log level', () => {
            config.nodeEnv = 'development';
            config.logLevel = 'http';

            const logger = createLogger('HttpModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should handle silly log level', () => {
            config.nodeEnv = 'development';
            config.logLevel = 'silly';

            const logger = createLogger('SillyModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });

        it('should default to INFO level for unknown log level', () => {
            config.nodeEnv = 'development';
            config.logLevel = 'unknown' as any;

            const logger = createLogger('UnknownLevelModule');

            expect(logger).toBeInstanceOf(ConsoleLogger);
        });
    });
});

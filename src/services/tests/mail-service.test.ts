import { ConsoleMailService } from '../mail-service';

describe('ConsoleMailService', () => {
    let service: ConsoleMailService;
    let consoleSpy: jest.SpyInstance;

    beforeAll(() => {
        service = new ConsoleMailService();
    });

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('sendPasswordResetEmail', () => {
        it('should log email content to console', async () => {
            await service.sendPasswordResetEmail(
                'test@example.com',
                'http://localhost:3000/reset-password?token=abc123'
            );

            expect(consoleSpy).toHaveBeenCalled();
            const logOutput = consoleSpy.mock.calls
                .map(call => call[0])
                .join('\n');
            expect(logOutput).toContain('PASSWORD RESET EMAIL');
            expect(logOutput).toContain('test@example.com');
            expect(logOutput).toContain(
                'http://localhost:3000/reset-password?token=abc123'
            );
        });

        it('should include expiration warning in email', async () => {
            await service.sendPasswordResetEmail(
                'test@example.com',
                'http://localhost:3000/reset-password?token=abc123'
            );

            const logOutput = consoleSpy.mock.calls
                .map(call => call[0])
                .join('\n');
            expect(logOutput).toContain('15 minutes');
        });

        it('should include security warning about unsolicited reset', async () => {
            await service.sendPasswordResetEmail(
                'test@example.com',
                'http://localhost:3000/reset-password?token=abc123'
            );

            const logOutput = consoleSpy.mock.calls
                .map(call => call[0])
                .join('\n');
            expect(logOutput).toContain('did not request');
        });

        it('should resolve without errors', async () => {
            await expect(
                service.sendPasswordResetEmail(
                    'test@example.com',
                    'http://localhost:3000/reset-password?token=abc123'
                )
            ).resolves.toBeUndefined();
        });
    });

    describe('sendPasswordResetConfirmation', () => {
        it('should log confirmation email content to console', async () => {
            await service.sendPasswordResetConfirmation('test@example.com');

            expect(consoleSpy).toHaveBeenCalled();
            const logOutput = consoleSpy.mock.calls
                .map(call => call[0])
                .join('\n');
            expect(logOutput).toContain('PASSWORD RESET CONFIRMATION');
            expect(logOutput).toContain('test@example.com');
        });

        it('should include security warning about unauthorized changes', async () => {
            await service.sendPasswordResetConfirmation('test@example.com');

            const logOutput = consoleSpy.mock.calls
                .map(call => call[0])
                .join('\n');
            expect(logOutput).toContain('did not make this change');
        });

        it('should mention session termination', async () => {
            await service.sendPasswordResetConfirmation('test@example.com');

            const logOutput = consoleSpy.mock.calls
                .map(call => call[0])
                .join('\n');
            expect(logOutput).toContain('sessions have been terminated');
        });

        it('should resolve without errors', async () => {
            await expect(
                service.sendPasswordResetConfirmation('test@example.com')
            ).resolves.toBeUndefined();
        });
    });
});

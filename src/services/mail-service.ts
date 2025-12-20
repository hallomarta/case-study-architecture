import { inject, injectable } from 'inversify';
import { createLogger } from '../lib/logger';
import { TOKEN } from '../lib/tokens';
import type { Config } from '../types/Config';

const logger = createLogger('MailService');

/**
 * Mail service interface for sending emails.
 * Implementations can use different email providers (SendGrid, AWS SES, etc.)
 * or a console logger for development/testing.
 */
export interface MailService {
    /**
     * Send password reset email with reset link.
     * @param to - Recipient email address
     * @param resetUrl - Full URL for password reset (includes token)
     */
    sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;

    /**
     * Send confirmation email after password has been reset.
     * @param to - Recipient email address
     */
    sendPasswordResetConfirmation(to: string): Promise<void>;
}

/**
 * Mask email for logging (e.g., "john@example.com" -> "j***@example.com")
 */
function maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
        return '***@***';
    }
    const maskedLocal =
        localPart.length > 1 ? localPart[0] + '***' : localPart[0] + '***';
    return `${maskedLocal}@${domain}`;
}

/**
 * Console-based mail service for development and testing.
 * Logs email content instead of actually sending emails.
 *
 * To switch to a real mail provider in production:
 * 1. Create a new implementation (e.g., SendGridMailService)
 * 2. Update the DI binding in inversify.config.ts
 */
@injectable()
export class ConsoleMailService implements MailService {
    constructor(@inject(TOKEN.Config) private config: Config) {}

    async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
        const maskedTo = maskEmail(to);

        logger.info('Password reset email requested', {
            event: 'PASSWORD_RESET_EMAIL',
            to: maskedTo,
        });

        // Log the full email content for development purposes (suppressed in tests)
        if (this.config.nodeEnv !== 'test') {
            console.log('\n' + '='.repeat(60));
            console.log('📧 PASSWORD RESET EMAIL');
            console.log('='.repeat(60));
            console.log(`To: ${to}`);
            console.log(`Subject: Reset Your Password`);
            console.log('-'.repeat(60));
            console.log('');
            console.log('You requested a password reset for your account.');
            console.log('');
            console.log('Click the link below to reset your password:');
            console.log(`${resetUrl}`);
            console.log('');
            console.log('This link will expire in 15 minutes.');
            console.log('');
            console.log(
                'If you did not request this reset, please ignore this email.'
            );
            console.log('Your password will remain unchanged.');
            console.log('');
            console.log('='.repeat(60) + '\n');
        }
    }

    async sendPasswordResetConfirmation(to: string): Promise<void> {
        const maskedTo = maskEmail(to);

        logger.info('Password reset confirmation email sent', {
            event: 'PASSWORD_RESET_CONFIRMATION_EMAIL',
            to: maskedTo,
        });

        // Log the full email content for development purposes (suppressed in tests)
        if (this.config.nodeEnv !== 'test') {
            console.log('\n' + '='.repeat(60));
            console.log('📧 PASSWORD RESET CONFIRMATION');
            console.log('='.repeat(60));
            console.log(`To: ${to}`);
            console.log(`Subject: Your Password Has Been Reset`);
            console.log('-'.repeat(60));
            console.log('');
            console.log('Your password has been successfully reset.');
            console.log('');
            console.log(
                'If you did not make this change, please contact support immediately.'
            );
            console.log('');
            console.log(
                'For security, all your active sessions have been terminated.'
            );
            console.log('Please log in again with your new password.');
            console.log('');
            console.log('='.repeat(60) + '\n');
        }
    }
}

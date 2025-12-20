import { inject } from 'inversify';
import { Controller, Post, Body } from '@inversifyjs/http-core';
import { ValidateStandardSchemaV1 } from '@inversifyjs/standard-schema-validation';
import { z } from 'zod';
import { TOKEN } from '../lib/tokens';
import type { PasswordService } from '../services/password-service';
import { passwordSchema, emailSchema } from '../lib/validation-schemas';

// Validation schemas
const forgotPasswordSchema = z
    .object({
        email: emailSchema,
    })
    .strict();

const resetPasswordSchema = z
    .object({
        token: z.string().min(1, 'Token is required'),
        newPassword: passwordSchema,
    })
    .strict();

type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

@Controller('/password')
export class PasswordController {
    constructor(
        @inject(TOKEN.PasswordService) private passwordService: PasswordService
    ) {}

    /**
     * Request a password reset email.
     *
     * SECURITY: Always returns 200 with the same message regardless of whether
     * the email exists in the system. This prevents user enumeration attacks.
     */
    @Post('/forgot')
    async forgotPassword(
        @Body()
        @ValidateStandardSchemaV1(forgotPasswordSchema)
        data: ForgotPasswordDto
    ) {
        return this.passwordService.requestPasswordReset(data.email);
    }

    /**
     * Reset password using a valid reset token.
     *
     * Returns 200 on success, or appropriate error status on failure.
     */
    @Post('/reset')
    async resetPassword(
        @Body()
        @ValidateStandardSchemaV1(resetPasswordSchema)
        data: ResetPasswordDto
    ) {
        return this.passwordService.resetPassword(data.token, data.newPassword);
    }
}

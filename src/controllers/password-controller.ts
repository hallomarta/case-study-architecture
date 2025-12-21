import { inject } from 'inversify';
import {
    Controller,
    Post,
    Body,
    HttpStatusCode,
    ApplyMiddleware,
} from '@inversifyjs/http-core';
import { PasswordResetRateLimitMiddleware } from '../middleware/rate-limit-middleware';
import {
    OasServer,
    OasSummary,
    OasDescription,
    OasOperationId,
    OasTag,
    OasRequestBody,
    OasResponse,
} from '@inversifyjs/http-open-api';
import { ValidateStandardSchemaV1 } from '@inversifyjs/standard-schema-validation';
import { TOKEN } from '../lib/tokens';
import type { PasswordService } from '../services/password-service';
import { zodToOpenApi } from '../lib/openapi';
import {
    forgotPasswordSchema,
    resetPasswordSchema,
    type ForgotPasswordDto,
    type ResetPasswordDto,
} from '../schemas/password-schemas';
import {
    successMessageSchema,
    errorResponseSchema,
    validationErrorResponseSchema,
} from '../schemas/generic-schemas';

@OasServer({
    description: 'Development server',
    url: 'http://localhost:3000',
})
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
    @OasSummary('Request password reset')
    @OasDescription(
        'Sends a password reset email if the account exists (always returns success for security)'
    )
    @OasOperationId('forgotPassword')
    @OasTag('password')
    @OasRequestBody({
        content: {
            'application/json': {
                schema: zodToOpenApi(forgotPasswordSchema),
            },
        },
        description: 'Email address',
        required: true,
    })
    @OasResponse(HttpStatusCode.OK, {
        content: {
            'application/json': {
                schema: zodToOpenApi(successMessageSchema),
            },
        },
        description:
            'Success message (always returned regardless of whether email exists)',
    })
    @OasResponse(HttpStatusCode.BAD_REQUEST, {
        content: {
            'application/json': {
                schema: zodToOpenApi(validationErrorResponseSchema),
            },
        },
        description: 'Validation error',
    })
    @OasResponse(HttpStatusCode.TOO_MANY_REQUESTS, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'Rate limit exceeded',
    })
    @Post('/forgot')
    @ApplyMiddleware(PasswordResetRateLimitMiddleware)
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
    @OasSummary('Reset password')
    @OasDescription('Resets password using a valid reset token from email')
    @OasOperationId('resetPassword')
    @OasTag('password')
    @OasRequestBody({
        content: {
            'application/json': {
                schema: zodToOpenApi(resetPasswordSchema),
            },
        },
        description: 'Reset token and new password',
        required: true,
    })
    @OasResponse(HttpStatusCode.OK, {
        content: {
            'application/json': {
                schema: zodToOpenApi(successMessageSchema),
            },
        },
        description: 'Password reset successfully',
    })
    @OasResponse(HttpStatusCode.BAD_REQUEST, {
        content: {
            'application/json': {
                schema: zodToOpenApi(validationErrorResponseSchema),
            },
        },
        description: 'Validation error',
    })
    @OasResponse(HttpStatusCode.UNAUTHORIZED, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'Invalid or expired reset token',
    })
    @Post('/reset')
    async resetPassword(
        @Body()
        @ValidateStandardSchemaV1(resetPasswordSchema)
        data: ResetPasswordDto
    ) {
        return this.passwordService.resetPassword(data.token, data.newPassword);
    }
}

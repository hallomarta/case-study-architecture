import { inject } from 'inversify';
import {
    Controller,
    Get,
    Post,
    Put,
    Body,
    UseGuard,
    CreatedHttpResponse,
    Request,
} from '@inversifyjs/http-core';
import { ValidateStandardSchemaV1 } from '@inversifyjs/standard-schema-validation';
import { z } from 'zod';
import type { Request as ExpressRequest } from 'express';
import { TOKEN } from '../lib/tokens';
import { getUser } from '../lib/request-utils';
import type { UserService } from '../services/user-service';
import { AuthGuard } from '../guards/auth-guard';
import { passwordSchema, emailSchema } from '../lib/validation-schemas';

// Validation schemas
const registerSchema = z
    .object({
        email: emailSchema,
        password: passwordSchema,
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
    })
    .strict();

const updateProfileSchema = z
    .object({
        firstName: z
            .string()
            .min(1, 'First name cannot be empty')
            .optional()
            .or(z.literal(undefined)),
        lastName: z
            .string()
            .min(1, 'Last name cannot be empty')
            .optional()
            .or(z.literal(undefined)),
    })
    .strict()
    .refine(
        data => {
            // Reject if firstName is provided but empty
            if ('firstName' in data && data.firstName === '') {
                return false;
            }
            // Reject if lastName is provided but empty
            if ('lastName' in data && data.lastName === '') {
                return false;
            }
            return true;
        },
        { message: 'Fields cannot be empty strings' }
    );

type RegisterDto = z.infer<typeof registerSchema>;
type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

/**
 * User Controller - User management endpoints
 *
 * Handles user registration and profile management.
 * Authentication endpoints are in OAuthController (/oauth/token, etc.)
 */
@Controller('/users')
export class UserController {
    constructor(@inject(TOKEN.UserService) private userService: UserService) {}

    /**
     * User Registration
     *
     * Creates a new user account with email/password.
     * Only available for local authentication provider.
     */
    @Post('/register')
    async register(
        @Body()
        @ValidateStandardSchemaV1(registerSchema)
        userData: RegisterDto
    ): Promise<CreatedHttpResponse> {
        const user = await this.userService.register(userData);
        return new CreatedHttpResponse(user);
    }

    /**
     * Get User Profile
     *
     * Returns the authenticated user's profile.
     * For OIDC-style claims, use GET /oauth/userinfo instead.
     */
    @Get('/profile')
    @UseGuard(AuthGuard)
    async getProfile(@Request() request: ExpressRequest) {
        const userId = getUser(request).id;
        const user = await this.userService.findById(userId);
        return user;
    }

    /**
     * Update User Profile
     *
     * Updates the authenticated user's profile fields.
     */
    @Put('/profile')
    @UseGuard(AuthGuard)
    async updateProfile(
        @Body()
        @ValidateStandardSchemaV1(updateProfileSchema)
        data: UpdateProfileDto,
        @Request() request: ExpressRequest
    ) {
        const userId = getUser(request).id;
        return this.userService.updateProfile(userId, data);
    }
}

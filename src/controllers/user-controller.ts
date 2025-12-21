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
    HttpStatusCode,
} from '@inversifyjs/http-core';
import {
    OasServer,
    OasSummary,
    OasDescription,
    OasOperationId,
    OasTag,
    OasRequestBody,
    OasResponse,
    OasSecurity,
} from '@inversifyjs/http-open-api';
import { ValidateStandardSchemaV1 } from '@inversifyjs/standard-schema-validation';
import type { Request as ExpressRequest } from 'express';
import { TOKEN } from '../lib/tokens';
import { getUser } from '../lib/request-utils';
import type { UserService } from '../services/user-service';
import { AuthGuard } from '../guards/auth-guard';
import { zodToOpenApi } from '../lib/openapi';
import {
    registerSchema,
    updateProfileSchema,
    userSchema,
    type RegisterDto,
    type UpdateProfileDto,
} from '../schemas/user-schemas';
import {
    errorResponseSchema,
    validationErrorResponseSchema,
} from '../schemas/generic-schemas';

/**
 * User Controller - User management endpoints
 *
 * Handles user registration and profile management.
 * Authentication endpoints are in OAuthController (/oauth/token, etc.)
 */
@OasServer({
    description: 'Development server',
    url: 'http://localhost:3000',
})
@Controller('/users')
export class UserController {
    constructor(@inject(TOKEN.UserService) private userService: UserService) {}

    /**
     * User Registration
     *
     * Creates a new user account with email/password.
     * Only available for local authentication provider.
     */
    @OasSummary('Register a new user')
    @OasDescription(
        'Creates a new user account with email/password authentication'
    )
    @OasOperationId('registerUser')
    @OasTag('users')
    @OasTag('authentication')
    @OasRequestBody({
        content: {
            'application/json': {
                schema: zodToOpenApi(registerSchema),
            },
        },
        description: 'User registration data',
        required: true,
    })
    @OasResponse(HttpStatusCode.CREATED, {
        content: {
            'application/json': {
                schema: zodToOpenApi(userSchema),
            },
        },
        description: 'User created successfully',
    })
    @OasResponse(HttpStatusCode.BAD_REQUEST, {
        content: {
            'application/json': {
                schema: zodToOpenApi(validationErrorResponseSchema),
            },
        },
        description: 'Validation error',
    })
    @OasResponse(HttpStatusCode.CONFLICT, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'User already exists',
    })
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
    @OasSummary('Get user profile')
    @OasDescription("Retrieves the authenticated user's profile")
    @OasOperationId('getUserProfile')
    @OasTag('users')
    @OasSecurity({
        bearerAuth: [],
    })
    @OasResponse(HttpStatusCode.OK, {
        content: {
            'application/json': {
                schema: zodToOpenApi(userSchema),
            },
        },
        description: 'User profile',
    })
    @OasResponse(HttpStatusCode.UNAUTHORIZED, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'Not authenticated',
    })
    @OasResponse(HttpStatusCode.NOT_FOUND, {
        content: {
            'application/json': {
                schema: zodToOpenApi(errorResponseSchema),
            },
        },
        description: 'User not found',
    })
    @Get('/profile')
    @UseGuard(AuthGuard)
    async getProfile(@Request() request: ExpressRequest) {
        const userId = getUser(request).id;
        return this.userService.findById(userId);
    }

    /**
     * Update User Profile
     *
     * Updates the authenticated user's profile fields.
     */
    @OasSummary('Update user profile')
    @OasDescription("Updates the authenticated user's profile fields")
    @OasOperationId('updateUserProfile')
    @OasTag('users')
    @OasSecurity({
        bearerAuth: [],
    })
    @OasRequestBody({
        content: {
            'application/json': {
                schema: zodToOpenApi(updateProfileSchema),
            },
        },
        description: 'Profile fields to update',
        required: true,
    })
    @OasResponse(HttpStatusCode.OK, {
        content: {
            'application/json': {
                schema: zodToOpenApi(userSchema),
            },
        },
        description: 'Updated user profile',
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
        description: 'Not authenticated',
    })
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

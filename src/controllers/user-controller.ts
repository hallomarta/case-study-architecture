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
    ApplyMiddleware,
} from '@inversifyjs/http-core';
import { ValidateStandardSchemaV1 } from '@inversifyjs/standard-schema-validation';
import { LoginRateLimitMiddleware } from '../middleware/rate-limit-middleware';
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

const loginSchema = z
    .object({
        email: emailSchema,
        password: z.string().min(1, 'Password is required'),
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

const refreshTokenSchema = z
    .object({
        refresh_token: z.string().min(1, 'Refresh token is required'),
    })
    .strict();

type RegisterDto = z.infer<typeof registerSchema>;
type LoginDto = z.infer<typeof loginSchema>;
type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

@Controller('/users')
export class UserController {
    constructor(@inject(TOKEN.UserService) private userService: UserService) {}

    @Post('/register')
    async register(
        @Body()
        @ValidateStandardSchemaV1(registerSchema)
        userData: RegisterDto
    ): Promise<CreatedHttpResponse> {
        const user = await this.userService.register(userData);
        return new CreatedHttpResponse(user);
    }

    @Post('/login')
    @ApplyMiddleware(LoginRateLimitMiddleware)
    async login(
        @Body()
        @ValidateStandardSchemaV1(loginSchema)
        credentials: LoginDto
    ) {
        return this.userService.authenticate(credentials);
    }

    @Get('/profile')
    @UseGuard(AuthGuard)
    async getProfile(@Request() request: ExpressRequest) {
        const userId = getUser(request).id;
        return this.userService.getProfile(userId);
    }

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

    @Post('/refresh')
    async refresh(
        @Body()
        @ValidateStandardSchemaV1(refreshTokenSchema)
        data: RefreshTokenDto
    ) {
        return this.userService.refreshAccessToken(data.refresh_token);
    }

    @Post('/logout')
    @UseGuard(AuthGuard)
    async logout(
        @Body()
        @ValidateStandardSchemaV1(refreshTokenSchema)
        data: RefreshTokenDto,
        @Request() request: ExpressRequest
    ) {
        const userId = getUser(request).id;
        await this.userService.logout(userId, data.refresh_token);
        return { message: 'Successfully logged out' };
    }

    @Post('/logout-all')
    @UseGuard(AuthGuard)
    async logoutAll(@Request() request: ExpressRequest) {
        const userId = getUser(request).id;
        await this.userService.logoutAll(userId);
        return { message: 'Successfully logged out from all devices' };
    }
}

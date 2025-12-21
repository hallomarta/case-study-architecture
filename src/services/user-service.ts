import { inject, injectable } from 'inversify';
import {
    ConflictHttpResponse,
    NotFoundHttpResponse,
} from '@inversifyjs/http-core';
import { TOKEN } from '../lib/tokens';
import type { PasswordUtilityService } from './password-utility-service';
import type { UserRepository } from '../repositories/user-repository';
import type { SafeUser } from '../entities/user';

/**
 * DTO for user registration
 */
export interface RegisterUserDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

/**
 * DTO for profile updates
 */
export interface UpdateProfileDto {
    firstName?: string;
    lastName?: string;
}

/**
 * UserService Interface - User CRUD operations only
 *
 * Authentication logic has been moved to:
 * - IdentityProvider: Credential validation
 * - TokenService: JWT generation/validation
 * - SessionService: Refresh token lifecycle
 */
export interface UserService {
    /**
     * Register a new user with email/password
     */
    register(userData: RegisterUserDto): Promise<SafeUser>;

    /**
     * Find a user by ID
     * @throws NotFoundHttpResponse if user not found
     */
    findById(userId: string): Promise<SafeUser>;

    /**
     * Update user profile
     * @throws NotFoundHttpResponse if user not found
     */
    updateProfile(userId: string, data: UpdateProfileDto): Promise<SafeUser>;
}

@injectable()
export class UserServiceImpl implements UserService {
    constructor(
        @inject(TOKEN.PasswordManagerService)
        private passwordManager: PasswordUtilityService,
        @inject(TOKEN.UserRepository) private userRepository: UserRepository
    ) {}

    async register(userData: RegisterUserDto): Promise<SafeUser> {
        // Check if user already exists
        const existingUser = await this.userRepository.findByEmail(
            userData.email
        );
        if (existingUser) {
            throw new ConflictHttpResponse(
                { message: 'User with this email already exists' },
                'User with this email already exists'
            );
        }

        // Hash password
        const hashedPassword = await this.passwordManager.toHash(
            userData.password
        );

        // Create user - returns SafeUser without identities
        const user = await this.userRepository.create({
            ...userData,
            password: hashedPassword,
        });

        return user;
    }

    async findById(userId: string): Promise<SafeUser> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundHttpResponse(
                { message: 'User not found' },
                'User not found'
            );
        }
        return user;
    }

    async updateProfile(
        userId: string,
        data: UpdateProfileDto
    ): Promise<SafeUser> {
        // Verify user exists (throws NotFoundHttpResponse if not found)
        await this.findById(userId);

        // Update returns SafeUser without identities
        return this.userRepository.update(userId, data);
    }
}

import { inject, injectable } from 'inversify';
import jwt from 'jsonwebtoken';
import {
    ConflictHttpResponse,
    UnauthorizedHttpResponse,
    NotFoundHttpResponse,
} from '@inversifyjs/http-core';
import { TOKEN } from '../lib/tokens';
import type { PasswordManagerService } from './password-manager-service';
import type { UserRepository } from '../repositories/user-repository';
import type { SafeUser } from '../entities/user';

export interface RegisterUserDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}

export interface LoginDto {
    email: string;
    password: string;
}

export interface UpdateProfileDto {
    firstName?: string;
    lastName?: string;
}

export interface AuthResponse {
    access_token: string;
}

export interface UserService {
    register(userData: RegisterUserDto): Promise<SafeUser>;
    authenticate(credentials: LoginDto): Promise<AuthResponse>;
    getProfile(userId: string): Promise<SafeUser>;
    updateProfile(userId: string, data: UpdateProfileDto): Promise<SafeUser>;
}

@injectable()
export class UserServiceImpl implements UserService {
    constructor(
        @inject(TOKEN.PasswordManagerService)
        private passwordManager: PasswordManagerService,
        @inject(TOKEN.UserRepository) private userRepository: UserRepository
    ) { }

    async register(userData: RegisterUserDto): Promise<SafeUser> {
        // Check if user already exists (efficient existence check)
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

    async authenticate(credentials: LoginDto): Promise<AuthResponse> {
        // SECURITY: Use explicit method to fetch identity data for authentication
        const user = await this.userRepository.findByEmailWithIdentity(credentials.email);
        if (!user) {
            // User doesn't exist or has no password identity
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid email or password' },
                'Invalid email or password'
            );
        }

        // Find username-password identity
        const identity = user.identities.find(
            id => id.provider === 'username-password'
        );
        if (!identity) {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid email or password' },
                'Invalid email or password'
            );
        }

        // Compare password
        const isPasswordValid = await this.passwordManager.compare(
            identity.passwordHash,
            credentials.password
        );

        if (!isPasswordValid) {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid email or password' },
                'Invalid email or password'
            );
        }

        // Generate JWT
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not configured');
        }

        const payload = {
            sub: user.id,
            email: user.email,
        };

        const token = jwt.sign(payload, jwtSecret, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        } as jwt.SignOptions);

        return { access_token: token };
    }

    async getProfile(userId: string): Promise<SafeUser> {
        // Fetch user WITHOUT sensitive identity data
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundHttpResponse(
                { message: 'User not found' },
                'User not found'
            );
        }

        return user;
    }

    async updateProfile(userId: string, data: UpdateProfileDto): Promise<SafeUser> {
        // Verify user exists
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundHttpResponse(
                { message: 'User not found' },
                'User not found'
            );
        }

        // Update returns SafeUser without identities
        return this.userRepository.update(userId, data);
    }
}

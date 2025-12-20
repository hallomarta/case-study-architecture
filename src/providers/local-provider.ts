import { inject, injectable } from 'inversify';
import { UnauthorizedHttpResponse } from '@inversifyjs/http-core';
import { TOKEN } from '../lib/tokens';
import type { IdentityProvider, LocalCredentials } from './identity-provider';
import type { PasswordManagerService } from '../services/password-manager-service';
import type { UserRepository } from '../repositories/user-repository';
import type { SafeUser } from '../entities/user';

/**
 * Local Identity Provider - handles email/password authentication.
 *
 * This provider authenticates users against the local database using
 * email and password credentials stored in the UserIdentity table.
 */
@injectable()
export class LocalIdentityProvider implements IdentityProvider {
    readonly name = 'local';

    constructor(
        @inject(TOKEN.PasswordManagerService)
        private passwordManager: PasswordManagerService,
        @inject(TOKEN.UserRepository)
        private userRepository: UserRepository
    ) {}

    async authenticate(credentials: LocalCredentials): Promise<SafeUser> {
        // Fetch user with identity data for password verification
        const user = await this.userRepository.findByEmailWithIdentity(
            credentials.email
        );

        if (!user) {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid email or password' },
                'Invalid email or password'
            );
        }

        // Find local (username-password) identity
        const identity = user.identities.find(
            id => id.provider === 'username-password'
        );

        if (!identity) {
            throw new UnauthorizedHttpResponse(
                { message: 'Invalid email or password' },
                'Invalid email or password'
            );
        }

        // Verify password
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

        // Return safe user (without identities)
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }

    supportsRegistration(): boolean {
        return true;
    }

    // OAuth methods not implemented for local provider
    // getAuthorizationUrl and handleCallback are not defined
}

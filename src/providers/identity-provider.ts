import type { SafeUser } from '../entities/user';

/**
 * Credentials for local (email/password) authentication
 */
export interface LocalCredentials {
    email: string;
    password: string;
}

/**
 * Result from OAuth provider callback containing user info
 */
export interface OAuthUserInfo {
    providerId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified?: boolean;
}

/**
 * Identity Provider interface - Strategy pattern for authentication methods.
 *
 * This abstraction allows supporting multiple authentication methods:
 * - LocalIdentityProvider: Email/password authentication
 * - GoogleIdentityProvider: Google OAuth (future)
 * - GitHubIdentityProvider: GitHub OAuth (future)
 *
 * Each provider implements the same interface, allowing the OAuthController
 * to work with any provider without knowing implementation details.
 */
export interface IdentityProvider {
    /**
     * Unique identifier for this provider (e.g., 'local', 'google', 'github')
     */
    readonly name: string;

    /**
     * Authenticate a user with provider-specific credentials.
     * For local provider: email/password
     * For OAuth providers: This method is not typically used; use handleCallback instead.
     *
     * @throws UnauthorizedHttpResponse if authentication fails
     */
    authenticate(credentials: LocalCredentials): Promise<SafeUser>;

    /**
     * Whether this provider supports user registration.
     * Local provider: true (users can create accounts)
     * OAuth providers: false (users register on the external provider)
     */
    supportsRegistration(): boolean;

    /**
     * Get the OAuth authorization URL to redirect the user to.
     * Only implemented by OAuth providers.
     *
     * @param state - CSRF protection state parameter
     * @returns Full URL to redirect user to for authentication
     *
     * @example
     * // For Google:
     * // https://accounts.google.com/o/oauth2/auth?client_id=...&redirect_uri=...&state=xyz
     */
    getAuthorizationUrl?(state: string): string;

    /**
     * Handle the OAuth callback after user authenticates with provider.
     * Exchanges authorization code for tokens and retrieves user info.
     * Creates or links user account in local database.
     *
     * @param code - Authorization code from OAuth provider
     * @returns User account (existing or newly created)
     */
    handleCallback?(code: string): Promise<SafeUser>;
}

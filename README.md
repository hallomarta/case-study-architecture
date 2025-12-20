# Design Decisions

This document outlines key architectural and security decisions made in this case study.

## Table of Contents

1. [Authentication Architecture](#authentication-architecture)
2. [Repository Security Pattern](#repository-security-pattern)
3. [Refresh Token Rotation](#refresh-token-rotation)
4. [Password Reset Flow](#password-reset-flow)
5. [Rate Limiting](#rate-limiting)
6. [Security Headers](#security-headers)
7. [Input Validation](#input-validation)
8. [Configuration Management](#configuration-management)
9. [Logger Architecture](#logger-architecture)

---

## Authentication Architecture

### Overview

The authentication service follows **OIDC-style conventions** for route naming while implementing an internal auth system. The architecture is designed to:

1. **Separate concerns** between authentication, token management, session management, and user management
2. **Enable future OAuth provider support** (Google, GitHub, etc.) without major refactoring
3. **Follow recognizable patterns** from OAuth 2.0/OIDC specifications

### Route Structure

Routes are organized following common OAuth 2.0/OIDC conventions:

| Route               | Method | Purpose                                                                                          |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `/oauth/token`      | POST   | Unified token endpoint (login via `grant_type=password`, refresh via `grant_type=refresh_token`) |
| `/oauth/revoke`     | POST   | Revoke current session                                                                           |
| `/oauth/revoke-all` | POST   | Revoke all sessions (custom extension)                                                           |
| `/oauth/userinfo`   | GET    | Get authenticated user claims (OIDC standard)                                                    |
| `/oauth/authorize`  | GET    | Future: Initiate OAuth flow with external providers                                              |
| `/oauth/callback`   | GET    | Future: Single callback for all OAuth providers (Auth0 pattern)                                  |
| `/users/register`   | POST   | User registration (local provider only)                                                          |
| `/users/profile`    | PUT    | Update user profile                                                                              |
| `/password/forgot`  | POST   | Request password reset                                                                           |
| `/password/reset`   | POST   | Reset password with token                                                                        |

**Note**: The OAuth 2.0 spec (RFC 6749) does not mandate specific URL paths—only endpoint behavior. We chose `/oauth/*` as it's the most recognizable convention used by Auth0, Okta, and others.

### Service Separation

```
OAuthController
    ↓
OAuthService
    ├→ IdentityProvider (LocalIdentityProvider)
    │   ├→ PasswordManagerService
    │   └→ UserRepository
    ├→ TokenService
    │   └→ Config
    ├→ SessionService
    │   ├→ TokenService
    │   └→ RefreshTokenRepository
    └→ UserService
        ├→ PasswordManagerService
        └→ UserRepository

UserController
    ↓
UserService
    ├→ PasswordManagerService
    └→ UserRepository
```

| Service              | Responsibility                                                   |
| -------------------- | ---------------------------------------------------------------- |
| **OAuthService**     | OAuth 2.0 grant type workflows (password, refresh_token)         |
| **TokenService**     | JWT generation (access_token, id_token), verification            |
| **SessionService**   | Refresh token lifecycle: create, rotate, revoke, reuse detection |
| **UserService**      | User CRUD operations only (no auth logic)                        |
| **IdentityProvider** | Authentication strategy abstraction                              |

### Identity Provider Pattern

To support multiple authentication methods (local, Google, GitHub), we use a **Strategy pattern**:

```typescript
interface IdentityProvider {
    name: string;
    
    // Local authentication
    authenticate(credentials: { email: string; password: string }): Promise<User>;
    
    // OAuth providers (optional methods for future)
    getAuthorizationUrl?(state: string, provider: string): string;
    handleCallback?(code: string, provider: string): Promise<User>;
}
```

**Current implementation**: `LocalIdentityProvider` handles email/password authentication.

**Future OAuth support**: When adding Google login, create `GoogleIdentityProvider` implementing the same interface:

```
GET /oauth/authorize?provider=google
  → GoogleIdentityProvider.getAuthorizationUrl(state)
  → Redirect to Google

GET /oauth/callback?code=xxx&state=yyy
  → GoogleIdentityProvider.handleCallback(code)
  → Find/create user, link identity
  → Issue app tokens via TokenService
```

### Token Response Format

The `/oauth/token` endpoint returns tokens following OAuth 2.0 conventions:

```json
{
    "access_token": "eyJ...",
    "token_type": "Bearer",
    "expires_in": 900,
    "refresh_token": "eyJ...",
    "id_token": "eyJ..."
}
```

The `id_token` is a JWT containing user identity claims (`sub`, `email`, `given_name`, `family_name`), allowing clients to decode user info without an additional API call.

### Account Linking Strategy

The existing `UserIdentity` model supports multiple providers per user:

```prisma
model UserIdentity {
    id           String  @id
    userId       String
    provider     String  // "local", "google", "github"
    providerId   String? // External user ID from OAuth provider
    passwordHash String? // Only for local provider
    user         User    @relation(...)
}
```

**Auto-linking policy**: When a user authenticates with an OAuth provider (e.g., Google) using an email that already exists in the system:
1. Link the new identity to the existing user account
2. User can now log in with either method

This avoids duplicate accounts and provides seamless multi-provider authentication.

### Why This Architecture?

| Decision                   | Rationale                                                               |
| -------------------------- | ----------------------------------------------------------------------- |
| OIDC-style routes          | Familiar conventions; easier migration to dedicated auth provider later |
| Single `/oauth/callback`   | Auth0 pattern; simpler than per-provider callbacks                      |
| Separate TokenService      | Centralized JWT logic; easier to modify token format/claims             |
| Separate SessionService    | Isolates refresh token rotation/reuse detection complexity              |
| IdentityProvider interface | Clean abstraction for adding OAuth providers                            |
| `id_token` in response     | OIDC-compatible; client gets user info without extra call               |

---

## Repository Security Pattern

### Entity Separation: User vs UserIdentity

Credentials are stored in a **separate table** from user profile data:

```
User                          UserIdentity
├── id                        ├── id
├── email                     ├── userId (FK)
├── firstName                 ├── provider ("username-password")
├── lastName                  ├── passwordHash  ← sensitive
├── createdAt                 ├── lastLoginAt
└── updatedAt                 └── createdAt/updatedAt
```

**Why separate tables?**
- A simple `SELECT * FROM users` never exposes password hashes
- Credentials are only loaded when explicitly joined
- Supports multiple auth methods per user (local + OAuth)
- Standard ORM queries on `User` are safe by default

### Repository Types

The `UserRepository` returns two distinct types to reinforce this separation:

| Type               | Contains Password Hash | Use Case                         |
| ------------------ | ---------------------- | -------------------------------- |
| `SafeUser`         | ❌ No                   | API responses, general app logic |
| `UserWithIdentity` | ✅ Yes                  | Authentication flows only        |

```typescript
// Default: safe for general use
findByEmail(email: string): Promise<SafeUser | null>;

// Explicit: only when password verification is needed
findByEmailWithIdentity(email: string): Promise<UserWithIdentity | null>;
```

Developers must explicitly request sensitive data. This makes accidental exposure a compile-time error rather than a runtime leak.

---

## Refresh Token Rotation

### Overview

This implementation uses **Refresh Token Rotation** with **Automatic Reuse Detection**, following the [OAuth 2.0 Security Best Current Practice](https://tools.ietf.org/html/draft-ietf-oauth-security-topics-13#section-4.12) and modeled after [Auth0's refresh token rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation).

### What is Refresh Token Rotation?

Refresh token rotation is a security technique where **a new refresh token is issued with each token refresh request**, and the old refresh token is immediately invalidated. This minimizes the window of opportunity for attackers who may have stolen a refresh token.

**Without rotation:**
- A stolen refresh token remains valid until expiration (e.g., 7 days)
- Attacker has prolonged access to user resources

**With rotation:**
- Each refresh token is single-use
- Stolen tokens become invalid after legitimate use
- Attack window is minimized

### Token Family Concept

We implement a **token family** mechanism to enable automatic reuse detection:

```
Login → Token A (family: X)
  ↓
Refresh → Token B (family: X), Token A revoked
  ↓
Refresh → Token C (family: X), Token B revoked
```

All tokens descended from a single login share the same `familyId`. This enables detecting when a previously-revoked token is reused.

### Automatic Reuse Detection

When a revoked refresh token is presented (indicating potential theft), the system:

1. **Detects the reuse** - Token exists but has `revokedAt` timestamp
2. **Invalidates the entire token family** - All tokens sharing the same `familyId` are revoked
3. **Logs a security event** - For monitoring and alerting
4. **Rejects the request** - Returns 401 Unauthorized

#### Attack Scenario Protection

```
1. Attacker steals Token A
2. Legitimate user refreshes → Token A revoked, Token B issued
3. Attacker tries to use Token A → REUSE DETECTED
4. System revokes Token B (and entire family)
5. Both attacker AND legitimate user are logged out
6. User must re-authenticate
```

This approach ensures that even if an attacker manages to use a stolen token first, the legitimate user's subsequent attempt will trigger family invalidation, limiting the attacker's access.

### Database Schema

```prisma
model RefreshToken {
    id        String    @id @default(uuid())
    tokenHash String    @unique
    userId    String
    familyId  String    // Groups tokens from same login session
    expiresAt DateTime
    createdAt DateTime  @default(now())
    revokedAt DateTime? // Soft-delete for reuse detection
    
    @@index([familyId])  // Fast family lookups for invalidation
}
```

### Security Benefits

| Feature             | Benefit                         |
| ------------------- | ------------------------------- |
| Single-use tokens   | Minimizes attack window         |
| Token families      | Enables reuse detection         |
| Reuse detection     | Detects and responds to theft   |
| Family invalidation | Limits attacker access duration |
| Soft revocation     | Maintains audit trail           |

### Trade-offs

- **Forced re-authentication**: When reuse is detected, legitimate users must log in again
- **Storage overhead**: Each refresh creates a new token record (mitigated by cleanup job)
- **Complexity**: More complex than simple token validation

---

## Password Reset Flow

### Overview

This implementation follows the [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) and [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) for secure password reset functionality.

### Token Generation

We use **cryptographically secure random tokens** rather than JWTs for password reset:

```typescript
import crypto from 'crypto';
const token = crypto.randomBytes(32).toString('hex'); // 256 bits = 64 hex chars
```

| Approach   | Decision   | Rationale                                                                     |
| ---------- | ---------- | ----------------------------------------------------------------------------- |
| **CSPRNG** | ✅ Chosen   | Unpredictable, no payload to decode, simpler security model                   |
| **JWT**    | ❌ Not used | Additional attack surface (algorithm confusion, etc.), unnecessary complexity |

**Token specifications:**
- **Length**: 32 bytes (256 bits of entropy)
- **Format**: Hex-encoded (64 characters)
- **Entropy**: Far exceeds OWASP's 64-bit minimum recommendation

### Token Storage

Tokens are **hashed before storage** using SHA-256:

```typescript
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
```

| Storage Approach  | Decision   | Rationale                                                                              |
| ----------------- | ---------- | -------------------------------------------------------------------------------------- |
| **SHA-256 hash**  | ✅ Chosen   | Fast hashing suitable for single-use tokens, prevents token theft if DB is compromised |
| **Plaintext**     | ❌ Not used | Token theft from DB compromise would allow password resets                             |
| **bcrypt/Argon2** | ❌ Not used | Unnecessary for single-use tokens (not passwords)                                      |

### Token Expiration

Password reset tokens expire after **15 minutes**:

| Application Type | OWASP Recommendation | Our Choice     |
| ---------------- | -------------------- | -------------- |
| High-security    | 15-30 minutes        | **15 minutes** |
| Standard         | Up to 1 hour         | —              |

**Rationale**: Short expiration limits the attack window if a token is intercepted in transit (email compromise, etc.).

### Single-Use Enforcement

Tokens are marked as used immediately after successful password reset:

```prisma
model PasswordResetToken {
    id        String    @id @default(uuid())
    tokenHash String    @unique
    userId    String
    expiresAt DateTime
    usedAt    DateTime? // Set when token is consumed
}
```

Additionally, when a new reset is requested, **all existing valid tokens for that user are invalidated**. This ensures only the most recent token works.

### User Enumeration Prevention

**Critical security measure**: The password reset endpoint returns the **same response regardless of whether the email exists**.

```typescript
// Always returns this message, whether email exists or not
return { 
    message: "If that email address is in our database, we will send you an email to reset your password." 
};
```

#### Timing Attack Prevention

To prevent attackers from detecting email existence via response timing differences:

```typescript
async requestPasswordReset(email: string) {
    const startTime = Date.now();
    
    // Process request (time varies based on whether user exists)
    await this.processRequest(email);
    
    // Normalize response time to minimum 500ms
    const elapsed = Date.now() - startTime;
    if (elapsed < 500) {
        await sleep(500 - elapsed);
    }
    
    return { message: "If that email address..." };
}
```

### Email Security

#### Reset Link Format

```
https://example.com/reset-password?token=abc123...
```

| Requirement              | Implementation                                              |
| ------------------------ | ----------------------------------------------------------- |
| **HTTPS only**           | ✅ Links use HTTPS                                           |
| **Hard-coded domain**    | ✅ Never uses `Host` header (prevents Host Header Injection) |
| **Token in query param** | ✅ Not in URL path (can leak in server logs)                 |

#### Email Content Security

| Include                                | Don't Include                  |
| -------------------------------------- | ------------------------------ |
| ✅ Reset link with token                | ❌ Username or password         |
| ✅ Expiration timeframe (15 min)        | ❌ Security questions           |
| ✅ "If you didn't request this" warning | ❌ Detailed account information |
| ✅ Support contact info                 | ❌ The token in plain text body |

### Post-Reset Security

When a password is successfully reset:

1. **Token is marked as used** — Single-use enforcement
2. **All refresh tokens are revoked** — Forces re-authentication on all devices
3. **Confirmation email is sent** — Alerts user to the change

```typescript
// Revoke all sessions after password reset
await this.refreshTokenRepository.revokeAllForUser(user.id);
```

This ensures that if an attacker reset the password, the legitimate user:
- Gets notified via confirmation email
- Is logged out of all sessions
- Must re-authenticate (and likely recover their account)

### Mail Service Architecture

The `MailService` interface allows swapping implementations via DI:

```typescript
export interface MailService {
    sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
    sendPasswordResetConfirmation(to: string): Promise<void>;
}
```

| Environment | Implementation                 | Purpose                       |
| ----------- | ------------------------------ | ----------------------------- |
| Development | `ConsoleMailService`           | Logs email content to console |
| Production  | `SendGridMailService` (future) | Sends actual emails           |
| Testing     | Mock implementation            | Unit test isolation           |

### Security Summary

| Aspect                 | Implementation                               |
| ---------------------- | -------------------------------------------- |
| Token generation       | 32 bytes CSPRNG, hex-encoded                 |
| Token storage          | SHA-256 hash                                 |
| Token expiry           | 15 minutes                                   |
| Single-use             | `usedAt` timestamp                           |
| Enumeration prevention | Identical responses + timing normalization   |
| Post-reset             | Revoke all refresh tokens, send confirmation |
| Email links            | HTTPS, hard-coded domain, Referrer-Policy    |

---

## Rate Limiting

### Login Attempts

Login attempts are rate-limited to prevent brute-force attacks:

| Setting      | Value        |
| ------------ | ------------ |
| Window       | 15 minutes   |
| Max attempts | 5 per window |
| Scope        | Per IP       |

Implemented via `express-rate-limit` middleware on `/oauth/token`.

### Password Reset Requests

Password reset is rate-limited **by email address** to prevent:
- Flooding a user's inbox with reset emails
- Denial of service via excessive token generation

| Setting      | Value        |
| ------------ | ------------ |
| Window       | 15 minutes   |
| Max attempts | 3 per window |
| Scope        | Per email    |

The `keyGenerator` uses the email from the request body as the rate limit key, ensuring attackers can't flood a specific user's inbox even from distributed IPs.

**Testing consideration**: Rate limit stores are exported and reset between tests to ensure test isolation.

---

## Security Headers

The application uses `helmet` middleware with default settings, which applies:

- `Content-Security-Policy` - Prevents XSS
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-Frame-Options: SAMEORIGIN` - Prevents clickjacking
- `Strict-Transport-Security` - Enforces HTTPS

CORS is configured via environment variable (`ALLOWED_ORIGINS`) to restrict which domains can call the API.

---

## Input Validation

Zod schemas serve as the **single source of truth** for both request validation and OpenAPI documentation. This eliminates drift between what the API accepts and what the docs describe.

```typescript
// Schema defines validation rules AND generates OpenAPI spec
export const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: z.string().min(1),
    lastName: z.string().min(1),
}).strict(); // Rejects unknown fields
```

**Password requirements** (per README spec):
- Minimum 8 characters, maximum 128
- At least one lowercase, one uppercase, one number

The `.strict()` modifier rejects unexpected fields, preventing mass assignment vulnerabilities.

---

## Configuration Management

### Overview

The application uses a **centralized configuration module** with Zod validation, ensuring all environment variables are validated at startup.

### Why Runtime Validation?

Validation runs at app startup, failing fast if required env vars are missing. This works well in development with small teams—missing configuration is caught immediately rather than causing cryptic errors later.

### Production Considerations

Runtime validation in production can cause downtime if configuration is missing at deploy time. Better approaches to research:

- **Build-time validation**: Validate env vars during CI/CD before deployment
- **Secrets management**: Tools like AWS Secrets Manager or HashiCorp Vault for secure secret distribution across environments

### Implementation

```typescript
// src/lib/config.ts
import { z } from 'zod';

const envSchema = z.object({
    PORT: z.string().default('9000').transform(Number),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    // ... other fields
});
```

| Feature              | Benefit                                             |
| -------------------- | --------------------------------------------------- |
| Fail-fast validation | App won't start with missing required env vars      |
| Type safety          | Config object is fully typed                        |
| Default values       | Centralized, documented defaults                    |
| Duration parsing     | Uses `ms` library to convert `'15m'` → milliseconds |
| Sensitive masking    | Secrets are masked in error output                  |

### Injectable Config via DI

Config is registered in the DI container for testability:

```typescript
constructor(@inject(TOKEN.Config) private config: Config) {}
```

For modules that run before or outside DI (like logger), direct import is available:

```typescript
import { getConfig } from './config';
```

### Test Configuration

Tests use `.env.test` with short-lived tokens. For unit tests needing specific config values:

```typescript
import { createTestConfig } from '../lib/config';
const config = createTestConfig({ accessTokenExpiresIn: 1000 });
```

### Environment Files

| File           | Purpose                | Auto-loaded when       |
| -------------- | ---------------------- | ---------------------- |
| `.env`         | Development defaults   | `NODE_ENV !== 'test'`  |
| `.env.test`    | Test-specific config   | `NODE_ENV === 'test'`  |
| `.env.example` | Documentation template | Never (copy to `.env`) |

---

## Logger Architecture

Uses `pino` with a factory pattern. The logger is **not injected via DI**—logging is cross-cutting and needed before the container initializes.

```typescript
import { createLogger } from '../lib/logger';
const logger = createLogger('UserService');

logger.info('User authenticated', { userId: '123', event: 'LOGIN' });
```

### Configuration

Log levels default based on `NODE_ENV`: production → INFO, development → DEBUG, test → ERROR. Override with `LOG_LEVEL` env var.

### Security Events

| Event                  | Level | Metadata                             |
| ---------------------- | ----- | ------------------------------------ |
| `LOGIN`                | info  | `userId`, `familyId`                 |
| `TOKEN_ROTATED`        | debug | `userId`, `familyId`                 |
| `TOKEN_REUSE_DETECTED` | error | `userId`, `familyId`, `revokedCount` |

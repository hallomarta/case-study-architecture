# Design Decisions

This document outlines key architectural and security decisions made in this case study.

## Table of Contents

1. [Configuration Management](#configuration-management)
2. [Refresh Token Rotation](#refresh-token-rotation)
3. [Logger Architecture](#logger-architecture)

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

## Logger Architecture

Uses `@inversifyjs/logger` with a factory pattern. The logger is **not injected via DI** as [recommended by Inversify](https://inversify.io/framework/docs/ecosystem/logger/).

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

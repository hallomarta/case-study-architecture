import { injectable } from 'inversify';
import rateLimit, {
    RateLimitRequestHandler,
    MemoryStore,
} from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import type { ExpressMiddleware } from '@inversifyjs/http-express';

// Shared stores that can be reset between tests
export const loginRateLimitStore = new MemoryStore();
export const passwordResetRateLimitStore = new MemoryStore();

// Legacy export for backwards compatibility
export const rateLimitStore = loginRateLimitStore;

// Create limiter at module load time to avoid "created in request handler" warning
const loginLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        message: 'Too many login attempts, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: loginRateLimitStore,
    validate: {
        // Disable creation stack validation for testing environments
        creationStack: false,
    },
});

// Password reset limiter - keyed by email to prevent inbox flooding
const passwordResetLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 attempts per window per email
    message: {
        message: 'Too many password reset attempts, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: passwordResetRateLimitStore,
    keyGenerator: (req: Request): string => {
        // Use email from request body as the rate limit key
        // This prevents attackers from flooding a specific user's inbox
        const email = req.body?.email?.toLowerCase() || 'unknown';
        return `password-reset:${email}`;
    },
    validate: {
        creationStack: false,
    },
});

@injectable()
export class LoginRateLimitMiddleware implements ExpressMiddleware {
    public execute(
        request: Request,
        response: Response,
        next: NextFunction
    ): void {
        loginLimiter(request, response, next);
    }
}

@injectable()
export class PasswordResetRateLimitMiddleware implements ExpressMiddleware {
    public execute(
        request: Request,
        response: Response,
        next: NextFunction
    ): void {
        passwordResetLimiter(request, response, next);
    }
}

import { injectable } from 'inversify';
import rateLimit, {
    RateLimitRequestHandler,
    MemoryStore,
} from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import type { ExpressMiddleware } from '@inversifyjs/http-express';

// Shared store that can be reset between tests
export const rateLimitStore = new MemoryStore();

// Create limiter at module load time to avoid "created in request handler" warning
const limiter: RateLimitRequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        message: 'Too many login attempts, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: rateLimitStore,
    validate: {
        // Disable creation stack validation for testing environments
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
        limiter(request, response, next);
    }
}

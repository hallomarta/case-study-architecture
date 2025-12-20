import { inject, injectable } from 'inversify';
import jwt from 'jsonwebtoken';
import { UnauthorizedHttpResponse } from '@inversifyjs/http-core';
import { ExpressGuard } from '@inversifyjs/http-express';
import type { Request } from 'express';
import type { AuthenticatedUser } from 'types/AuthenticatedUser';
import { TOKEN } from '../lib/tokens';
import type { Config } from '../types/Config';

interface JWTPayload {
    sub: string;
    email: string;
    iat: number;
    exp: number;
}

@injectable()
export class AuthGuard implements ExpressGuard {
    constructor(@inject(TOKEN.Config) private config: Config) { }

    public activate(request: Request): boolean {
        const authHeader = request.headers.authorization;

        if (!authHeader) {
            throw new UnauthorizedHttpResponse(
                { message: 'Authorization token required' },
                'Authorization token required'
            );
        }

        // Extract Bearer token
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            throw new UnauthorizedHttpResponse(
                {
                    message:
                        'Invalid authorization format. Expected: Bearer <token>',
                },
                'Invalid authorization format'
            );
        }

        const token = parts[1];

        try {
            // Verify and decode token with explicit algorithm restriction
            const payload = jwt.verify(token, this.config.accessTokenSecret, {
                algorithms: ['HS256'],
            }) as JWTPayload;

            // Attach user info to request
            request.user = {
                id: payload.sub,
                email: payload.email,
            } satisfies AuthenticatedUser;

            return true;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new UnauthorizedHttpResponse(
                    { message: 'Token has expired' },
                    'Token has expired'
                );
            }

            if (error instanceof jwt.JsonWebTokenError) {
                throw new UnauthorizedHttpResponse(
                    { message: 'Invalid token' },
                    'Invalid token'
                );
            }

            // Re-throw configuration errors
            throw error;
        }
    }
}

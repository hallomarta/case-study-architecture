import type { Request } from 'express';
import type { AuthenticatedUser } from "../types/AuthenticatedUser";

/**
 * Extracts authenticated user from request.
 * Throws if user is not present (should never happen after AuthGuard).
 * Acts as a type assertion for TypeScript.
 */
export function getUser(req: Request): AuthenticatedUser {
    if (!req.user) {
        throw new Error(
            'User not found in request. AuthGuard may not be applied.'
        );
    }
    return req.user;
}

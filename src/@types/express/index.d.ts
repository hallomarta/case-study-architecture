import type { AuthenticatedUser } from 'types/AuthenticatedUser';

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

export {};

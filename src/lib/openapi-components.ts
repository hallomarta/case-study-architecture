import { createSchema } from 'zod-openapi';

// Import all schemas
import {
    successMessageSchema,
    errorResponseSchema,
    validationErrorResponseSchema,
} from '../schemas/generic-schemas';
import {
    userSchema,
    registerSchema,
    updateProfileSchema,
} from '../schemas/user-schemas';
import {
    tokenResponseSchema,
    userInfoSchema,
    tokenRequestSchema,
    revokeRequestSchema,
} from '../schemas/oauth-schemas';
import {
    forgotPasswordSchema,
    resetPasswordSchema,
} from '../schemas/password-schemas';

/**
 * Generate OpenAPI components from all Zod schemas
 * This extracts the component definitions that $refs point to
 */
export function generateOpenApiComponents(): Record<string, any> {
    const allSchemas = [
        // Generic schemas
        successMessageSchema,
        errorResponseSchema,
        validationErrorResponseSchema,
        // User schemas
        userSchema,
        registerSchema,
        updateProfileSchema,
        // OAuth schemas
        tokenResponseSchema,
        userInfoSchema,
        tokenRequestSchema,
        revokeRequestSchema,
        // Password schemas
        forgotPasswordSchema,
        resetPasswordSchema,
    ];

    const components: Record<string, any> = {};

    // Extract components from each schema
    for (const schema of allSchemas) {
        const result = createSchema(schema);
        // createSchema returns { schema, components } where components is the actual schema definitions
        if (result.components) {
            Object.assign(components, result.components);
        }
    }

    return components;
}

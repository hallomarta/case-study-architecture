import { createSchema } from 'zod-openapi';
import type { ZodSchema } from 'zod';

/**
 * Helper to convert Zod schema to OpenAPI schema object
 *
 * Returns the schema as-is with $ref if it has one.
 * The @inversifyjs/http-open-api framework will handle resolving refs
 * if we populate the components properly in the SwaggerUiProvider config.
 */
export function zodToOpenApi(zodSchema: ZodSchema): any {
    const result = createSchema(zodSchema);
    return result.schema;
}
